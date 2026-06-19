export interface ResolveResult {
	category_id: number | null;
	source: 'override' | 'manual' | 'ai_auto' | 'fallback' | null;
}

/**
 * Resolve a raw_category to a category_id using a 4-layer priority chain.
 *   1. category_overrides (expense-specific override) → category_id
 *   2. category_aliases where source='manual' → category_id
 *   3. category_aliases where source='ai_auto' → category_id
 *   4. fallback: exact name match in categories table (child only, non-deleted)
 *   5. Otherwise: null (pending/unresolved)
 */
export async function resolveCategory(
	db: D1Database,
	householdId: string,
	rawCategory: string,
	expenseId?: string
): Promise<ResolveResult> {
	// Layer 1: expense-specific override
	if (expenseId) {
		const override = await db
			.prepare(
				`SELECT category_id FROM category_overrides
				 WHERE expense_id = ? AND field = 'category' AND category_id IS NOT NULL
				 ORDER BY created_at DESC LIMIT 1`
			)
			.bind(expenseId)
			.first<{ category_id: number }>();

		if (override) {
			return { category_id: override.category_id, source: 'override' };
		}
	}

	// Layer 2 & 3: alias lookup (manual wins over ai_auto via ORDER BY)
	const alias = await db
		.prepare(
			`SELECT category_id, source FROM category_aliases
			 WHERE household_id = ? AND raw_category = ? AND category_id IS NOT NULL
			 ORDER BY CASE source WHEN 'manual' THEN 0 WHEN 'ai_auto' THEN 1 END
			 LIMIT 1`
		)
		.bind(householdId, rawCategory)
		.first<{ category_id: number; source: string }>();

	if (alias) {
		return {
			category_id: alias.category_id,
			source: alias.source as 'manual' | 'ai_auto'
		};
	}

	// Layer 4: fallback — exact name match against non-deleted child categories
	const cat = await db
		.prepare(
			`SELECT id FROM categories
			 WHERE household_id = ? AND name = ? AND parent_id IS NOT NULL AND is_deleted = 0
			 LIMIT 1`
		)
		.bind(householdId, rawCategory)
		.first<{ id: number }>();

	if (cat) {
		return { category_id: cat.id, source: 'fallback' };
	}

	// Unresolved
	return { category_id: null, source: null };
}

/**
 * Resolve categories for a batch of expenses and update them in the DB.
 * Used after import commit to apply existing alias mappings.
 */
export async function resolveCategoriesForImport(
	db: D1Database,
	householdId: string,
	importId: string
): Promise<{ resolved: number; pending: number }> {
	const expenses = await db
		.prepare(
			`SELECT id, raw_category FROM expenses
			 WHERE source_import_id = ? AND household_id = ? AND category_id IS NULL`
		)
		.bind(importId, householdId)
		.all<{ id: string; raw_category: string }>();

	let resolved = 0;
	let pending = 0;

	for (const expense of expenses.results) {
		const result = await resolveCategory(db, householdId, expense.raw_category, expense.id);

		if (result.category_id) {
			await db
				.prepare(
					`UPDATE expenses SET category_id = ?, updated_at = datetime('now')
					 WHERE id = ?`
				)
				.bind(result.category_id, expense.id)
				.run();
			resolved++;
		} else {
			pending++;
		}
	}

	return { resolved, pending };
}

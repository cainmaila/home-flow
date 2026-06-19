import { STANDARD_CATEGORY_SET } from '$lib/config/categories';

export interface ResolveResult {
	normalized_category: string | null;
	source: 'override' | 'manual' | 'ai_auto' | 'fallback' | null;
}

/**
 * Resolve a raw_category to its normalized_category using a 4-layer priority chain.
 * Data-Rules §4.4:
 *   1. category_overrides (expense-specific override)
 *   2. category_aliases where source='manual'
 *   3. category_aliases where source='ai_auto'
 *   4. fallback: exact match with standard category name
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
				`SELECT new_value FROM category_overrides
				 WHERE expense_id = ? AND field = 'category'
				 ORDER BY created_at DESC LIMIT 1`
			)
			.bind(expenseId)
			.first<{ new_value: string }>();

		if (override) {
			return { normalized_category: override.new_value, source: 'override' };
		}
	}

	// Layer 2 & 3: alias lookup (manual wins over ai_auto via ORDER BY)
	const alias = await db
		.prepare(
			`SELECT normalized_category, source FROM category_aliases
			 WHERE household_id = ? AND raw_category = ?
			 ORDER BY CASE source WHEN 'manual' THEN 0 WHEN 'ai_auto' THEN 1 END
			 LIMIT 1`
		)
		.bind(householdId, rawCategory)
		.first<{ normalized_category: string; source: string }>();

	if (alias) {
		return {
			normalized_category: alias.normalized_category,
			source: alias.source as 'manual' | 'ai_auto'
		};
	}

	// Layer 4: fallback - exact match with standard category
	if (STANDARD_CATEGORY_SET.has(rawCategory)) {
		return { normalized_category: rawCategory, source: 'fallback' };
	}

	// Unresolved
	return { normalized_category: null, source: null };
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
	// Get all expenses from this import that have no normalized_category
	const expenses = await db
		.prepare(
			`SELECT id, raw_category FROM expenses
			 WHERE source_import_id = ? AND household_id = ? AND normalized_category IS NULL`
		)
		.bind(importId, householdId)
		.all<{ id: string; raw_category: string }>();

	let resolved = 0;
	let pending = 0;

	for (const expense of expenses.results) {
		const result = await resolveCategory(db, householdId, expense.raw_category, expense.id);

		if (result.normalized_category) {
			await db
				.prepare(
					`UPDATE expenses SET normalized_category = ?, updated_at = datetime('now')
					 WHERE id = ?`
				)
				.bind(result.normalized_category, expense.id)
				.run();
			resolved++;
		} else {
			pending++;
		}
	}

	return { resolved, pending };
}

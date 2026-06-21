import type { PreviewRecord } from './preview';
import { resolveCategoriesForImport } from '../category/resolve';
import { isAIEnabled, getAutoAcceptThreshold } from '../ai/config';
import { suggestCategories, loadCategoriesWithExamples } from '../ai/gemini';
import { isAutoSuggestDisabled, isQuotaExceeded } from '../ai/quota';
import { setExpenseTags } from '../tags';

export interface AISuggestionResult {
	autoAccepted: number;
	pending: number;
	total: number;
}

export interface CommitResult {
	importId: string;
	inserted: number;
	duplicates: number;
	updated: number;
	skipped: number;
	categoryResolution?: { resolved: number; pending: number };
	aiSuggestions?: AISuggestionResult;
}

/**
 * Commit previewed records to the expenses table.
 * - 'new' records: INSERT
 * - 'duplicate' records: skip
 * - 'update' with resolution 'use_new': UPDATE existing expense amount
 * - 'update' with resolution 'keep_old' or 'skip': skip
 * Updates the import job with summary fields and status='committed'.
 */
export async function commitImport(
	db: D1Database,
	importId: string,
	householdId: string,
	records: PreviewRecord[],
	env?: App.Platform['env']
): Promise<CommitResult> {
	let inserted = 0;
	let duplicates = 0;
	let updated = 0;
	let skipped = 0;

	for (const pr of records) {
		if (pr.status === 'duplicate') {
			duplicates++;
			continue;
		}

		if (pr.status === 'new') {
			const id = crypto.randomUUID();
			await db
				.prepare(
					`INSERT INTO expenses (id, household_id, expense_date, raw_category, normalized_category, amount, source_import_id, detail)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					householdId,
					pr.record.expense_date,
					pr.record.raw_category,
					pr.record.normalized_category ?? null,
					pr.record.amount,
					importId,
					pr.record.raw_category
				)
				.run();
			if (pr.record.auto_tags && pr.record.auto_tags.length > 0) {
				await setExpenseTags(db, householdId, id, pr.record.auto_tags);
			}
			inserted++;
			continue;
		}

		// status === 'update'
		const resolution = pr.resolution ?? 'skip';
		if (resolution === 'use_new') {
			await db
				.prepare(
					`UPDATE expenses SET amount = ?, source_import_id = ?, updated_at = datetime('now')
					 WHERE household_id = ? AND expense_date = ? AND raw_category = ?`
				)
				.bind(
					pr.record.amount,
					importId,
					householdId,
					pr.record.expense_date,
					pr.record.raw_category
				)
				.run();
			updated++;
		} else {
			skipped++;
		}
	}

	// Update import job
	await db
		.prepare(
			`UPDATE imports
			 SET status = 'committed',
			     inserted_rows = ?,
			     duplicate_rows = ?,
			     updated_rows = ?,
			     skipped_rows = ?,
			     committed_at = datetime('now')
			 WHERE id = ?`
		)
		.bind(inserted, duplicates, updated, skipped, importId)
		.run();

	// Apply category resolution to newly imported expenses (T3.5)
	const categoryResolution = await resolveCategoriesForImport(db, householdId, importId);

	// T5.4: Post-import AI suggestions for unmatched categories
	let aiSuggestions: AISuggestionResult | undefined;
	if (env && isAIEnabled(env) && !isQuotaExceeded() && !isAutoSuggestDisabled()) {
		aiSuggestions = await generatePostImportSuggestions(
			db,
			importId,
			householdId,
			env.GOOGLE_AI_API_KEY!,
			getAutoAcceptThreshold(env)
		);
	}

	return { importId, inserted, duplicates, updated, skipped, categoryResolution, aiSuggestions };
}

/**
 * T5.4: After commit, find unmatched raw_categories from this import,
 * call Gemini for suggestions, auto-accept high confidence, store low confidence as pending.
 */
async function generatePostImportSuggestions(
	db: D1Database,
	importId: string,
	householdId: string,
	apiKey: string,
	threshold: number
): Promise<AISuggestionResult> {
	// Find unmatched raw_categories from this import
	const rows = await db
		.prepare(
			`SELECT DISTINCT raw_category FROM expenses
			 WHERE source_import_id = ? AND household_id = ? AND category_id IS NULL`
		)
		.bind(importId, householdId)
		.all<{ raw_category: string }>();

	const unmatched = rows.results.map((r) => r.raw_category);
	if (unmatched.length === 0) return { autoAccepted: 0, pending: 0, total: 0 };

	const catsWithExamples = await loadCategoriesWithExamples(db, householdId);
	if (catsWithExamples.length === 0) return { autoAccepted: 0, pending: 0, total: 0 };

	const suggestions = await suggestCategories(unmatched, apiKey, catsWithExamples);
	if (suggestions.length === 0) return { autoAccepted: 0, pending: 0, total: 0 };

	// Build name→id lookup from DB
	const catRows = await db
		.prepare(
			`SELECT id, name FROM categories
			 WHERE household_id = ? AND parent_id IS NOT NULL AND is_deleted = 0`
		)
		.bind(householdId)
		.all<{ id: number; name: string }>();

	const nameToId = new Map<string, number>();
	for (const r of catRows.results) {
		nameToId.set(r.name, r.id);
	}

	let autoAccepted = 0;
	let pending = 0;

	for (const s of suggestions) {
		const categoryId = nameToId.get(s.suggested_category);

		if (s.confidence >= threshold && categoryId) {
			const tagsJson = s.tags.length > 0 ? JSON.stringify(s.tags) : null;
			await db
				.prepare(
					`INSERT INTO category_aliases (id, household_id, raw_category, normalized_category, category_id, source, tags)
					 VALUES (?, ?, ?, ?, ?, 'ai_auto', ?)
					 ON CONFLICT (household_id, raw_category) DO UPDATE SET
					   normalized_category = excluded.normalized_category,
					   category_id = excluded.category_id,
					   source = 'ai_auto',
					   tags = excluded.tags`
				)
				.bind(crypto.randomUUID(), householdId, s.raw_category, s.suggested_category, categoryId, tagsJson)
				.run();

			const affected = await db
				.prepare(
					`SELECT id FROM expenses
					 WHERE household_id = ? AND raw_category = ? AND category_id IS NULL`
				)
				.bind(householdId, s.raw_category)
				.all<{ id: string }>();

			for (const exp of affected.results) {
				await db
					.prepare(
						`UPDATE expenses SET category_id = ?, updated_at = datetime('now')
						 WHERE id = ?`
					)
					.bind(categoryId, exp.id)
					.run();
				if (s.tags.length > 0) {
					await setExpenseTags(db, householdId, exp.id, s.tags);
				}
			}

			await db
				.prepare(
					`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, suggested_category_id, confidence, status, resolved_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 'accepted', datetime('now'))`
				)
				.bind(
					crypto.randomUUID(),
					householdId,
					importId,
					s.raw_category,
					s.suggested_category,
					categoryId,
					s.confidence
				)
				.run();

			autoAccepted++;
		} else {
			await db
				.prepare(
					`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, suggested_category_id, confidence, status)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
				)
				.bind(
					crypto.randomUUID(),
					householdId,
					importId,
					s.raw_category,
					s.suggested_category,
					categoryId ?? null,
					s.confidence
				)
				.run();

			pending++;
		}
	}

	return { autoAccepted, pending, total: suggestions.length };
}

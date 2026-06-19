import type { PreviewRecord } from './preview';
import { resolveCategoriesForImport } from '../category/resolve';
import { isAIEnabled, getAutoAcceptThreshold } from '../ai/config';
import { suggestCategories } from '../ai/gemini';
import { isAutoSuggestDisabled, isQuotaExceeded } from '../ai/quota';
import { STANDARD_CATEGORIES } from '$lib/config/categories';

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
					`INSERT INTO expenses (id, household_id, expense_date, raw_category, normalized_category, amount, is_fixed_expense, source_import_id)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					householdId,
					pr.record.expense_date,
					pr.record.raw_category,
					pr.record.normalized_category ?? null,
					pr.record.amount,
					pr.record.is_fixed_expense ? 1 : 0,
					importId
				)
				.run();
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
			 WHERE source_import_id = ? AND household_id = ? AND normalized_category IS NULL`
		)
		.bind(importId, householdId)
		.all<{ raw_category: string }>();

	const unmatched = rows.results.map((r) => r.raw_category);
	if (unmatched.length === 0) return { autoAccepted: 0, pending: 0, total: 0 };

	const suggestions = await suggestCategories(unmatched, [...STANDARD_CATEGORIES], apiKey);
	if (suggestions.length === 0) return { autoAccepted: 0, pending: 0, total: 0 };

	let autoAccepted = 0;
	let pending = 0;

	for (const s of suggestions) {
		if (s.confidence >= threshold) {
			// High confidence: auto-write to category_aliases
			await db
				.prepare(
					`INSERT INTO category_aliases (id, household_id, raw_category, normalized_category, source)
					 VALUES (?, ?, ?, ?, 'ai_auto')
					 ON CONFLICT (household_id, raw_category) DO UPDATE SET normalized_category = excluded.normalized_category, source = 'ai_auto'`
				)
				.bind(crypto.randomUUID(), householdId, s.raw_category, s.suggested_category)
				.run();

			// Update expenses with this raw_category
			await db
				.prepare(
					`UPDATE expenses SET normalized_category = ?, updated_at = datetime('now')
					 WHERE household_id = ? AND raw_category = ? AND normalized_category IS NULL`
				)
				.bind(s.suggested_category, householdId, s.raw_category)
				.run();

			// Store as accepted suggestion for audit trail
			await db
				.prepare(
					`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, confidence, status, resolved_at)
					 VALUES (?, ?, ?, ?, ?, ?, 'accepted', datetime('now'))`
				)
				.bind(
					crypto.randomUUID(),
					householdId,
					importId,
					s.raw_category,
					s.suggested_category,
					s.confidence
				)
				.run();

			autoAccepted++;
		} else {
			// Low confidence: store as pending for manual review
			await db
				.prepare(
					`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, confidence, status)
					 VALUES (?, ?, ?, ?, ?, ?, 'pending')`
				)
				.bind(
					crypto.randomUUID(),
					householdId,
					importId,
					s.raw_category,
					s.suggested_category,
					s.confidence
				)
				.run();

			pending++;
		}
	}

	return { autoAccepted, pending, total: suggestions.length };
}

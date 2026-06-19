import type { PreviewRecord } from './preview';

export interface CommitResult {
	importId: string;
	inserted: number;
	duplicates: number;
	updated: number;
	skipped: number;
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
	records: PreviewRecord[]
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

	return { importId, inserted, duplicates, updated, skipped };
}

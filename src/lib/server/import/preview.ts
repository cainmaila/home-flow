import type { ExpenseRecord } from '../csv/normalize';

export interface PreviewRecord {
	record: ExpenseRecord;
	status: 'new' | 'duplicate' | 'update';
	existingAmount?: number;
	resolution?: 'use_new' | 'keep_old' | 'skip';
}

export interface PreviewResult {
	importId: string;
	records: PreviewRecord[];
	summary: { parsed: number; newRecords: number; duplicates: number; updates: number };
}

/**
 * Build a preview of what an import would do, checking each record against existing expenses.
 * Creates an import job with status='previewed'. Does NOT write to the expenses table.
 */
export async function buildPreview(
	db: D1Database,
	records: ExpenseRecord[],
	householdId: string,
	uploadedBy: string,
	filename: string
): Promise<PreviewResult> {
	const importId = crypto.randomUUID();
	const previewRecords: PreviewRecord[] = [];

	for (const record of records) {
		// Exact match (same date + category + amount) = duplicate
		const exact = await db
			.prepare(
				`SELECT id FROM expenses
				 WHERE household_id = ? AND expense_date = ? AND raw_category = ? AND amount = ?
				 LIMIT 1`
			)
			.bind(householdId, record.expense_date, record.raw_category, record.amount)
			.first<{ id: string }>();

		if (exact) {
			previewRecords.push({ record, status: 'duplicate' });
			continue;
		}

		// Same date + category but different amount = update candidate
		const candidate = await db
			.prepare(
				`SELECT id, amount FROM expenses
				 WHERE household_id = ? AND expense_date = ? AND raw_category = ?
				 LIMIT 1`
			)
			.bind(householdId, record.expense_date, record.raw_category)
			.first<{ id: string; amount: number }>();

		if (candidate) {
			previewRecords.push({
				record,
				status: 'update',
				existingAmount: candidate.amount,
				resolution: 'use_new'
			});
			continue;
		}

		previewRecords.push({ record, status: 'new' });
	}

	const summary = {
		parsed: records.length,
		newRecords: previewRecords.filter((r) => r.status === 'new').length,
		duplicates: previewRecords.filter((r) => r.status === 'duplicate').length,
		updates: previewRecords.filter((r) => r.status === 'update').length
	};

	// Create import job with status='previewed'
	await db
		.prepare(
			`INSERT INTO imports (id, household_id, uploaded_by, filename, status, parsed_rows)
			 VALUES (?, ?, ?, ?, 'previewed', ?)`
		)
		.bind(importId, householdId, uploadedBy, filename, records.length)
		.run();

	return { importId, records: previewRecords, summary };
}

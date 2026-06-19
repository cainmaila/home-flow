import { describe, it, expect } from 'vitest';
import type { ExpenseRecord } from '../csv/normalize';
import type { PreviewRecord } from './preview';

/**
 * Unit tests for the dedup classification logic.
 * These test the categorization rules in-memory without requiring D1.
 * The actual buildPreview function uses D1 queries; here we test the
 * classification logic that determines new/duplicate/update status.
 */

/** Simulate the dedup classification that buildPreview performs per record. */
function classifyRecord(
	record: ExpenseRecord,
	existingExpenses: { expense_date: string; raw_category: string; amount: number }[]
): Pick<PreviewRecord, 'status' | 'existingAmount' | 'resolution'> {
	// Exact match = duplicate
	const exact = existingExpenses.find(
		(e) =>
			e.expense_date === record.expense_date &&
			e.raw_category === record.raw_category &&
			e.amount === record.amount
	);
	if (exact) return { status: 'duplicate' };

	// Same date+category, different amount = update
	const candidate = existingExpenses.find(
		(e) =>
			e.expense_date === record.expense_date &&
			e.raw_category === record.raw_category &&
			e.amount !== record.amount
	);
	if (candidate) {
		return { status: 'update', existingAmount: candidate.amount, resolution: 'use_new' };
	}

	return { status: 'new' };
}

function makeRecord(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
	return {
		household_id: 'hh-1',
		expense_date: '2026-06-01',
		raw_category: '午餐',
		normalized_category: null,
		amount: 200,
		is_fixed_expense: false,
		source_import_id: null,
		...overrides
	};
}

describe('dedup classification', () => {
	it('marks new records when no existing data', () => {
		const record = makeRecord();
		const result = classifyRecord(record, []);
		expect(result.status).toBe('new');
	});

	it('marks duplicate when exact match exists', () => {
		const record = makeRecord({ amount: 200 });
		const existing = [{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 }];
		const result = classifyRecord(record, existing);
		expect(result.status).toBe('duplicate');
	});

	it('marks update when same date+category but different amount', () => {
		const record = makeRecord({ amount: 250 });
		const existing = [{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 }];
		const result = classifyRecord(record, existing);
		expect(result.status).toBe('update');
		expect(result.existingAmount).toBe(200);
		expect(result.resolution).toBe('use_new');
	});

	it('marks new when different category', () => {
		const record = makeRecord({ raw_category: '晚餐' });
		const existing = [{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 }];
		const result = classifyRecord(record, existing);
		expect(result.status).toBe('new');
	});

	it('marks new when different date', () => {
		const record = makeRecord({ expense_date: '2026-06-02' });
		const existing = [{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 }];
		const result = classifyRecord(record, existing);
		expect(result.status).toBe('new');
	});

	it('re-import same file: all duplicate', () => {
		const records = [
			makeRecord({ raw_category: '午餐', amount: 200 }),
			makeRecord({ raw_category: '晚餐', amount: 350 }),
			makeRecord({ expense_date: '2026-06-02', raw_category: '午餐', amount: 180 })
		];
		const existing = [
			{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 },
			{ expense_date: '2026-06-01', raw_category: '晚餐', amount: 350 },
			{ expense_date: '2026-06-02', raw_category: '午餐', amount: 180 }
		];
		const results = records.map((r) => classifyRecord(r, existing));
		expect(results.every((r) => r.status === 'duplicate')).toBe(true);
	});

	it('change one amount: 1 update, rest duplicate', () => {
		const records = [
			makeRecord({ raw_category: '午餐', amount: 200 }),
			makeRecord({ raw_category: '晚餐', amount: 400 }), // changed from 350
			makeRecord({ expense_date: '2026-06-02', raw_category: '午餐', amount: 180 })
		];
		const existing = [
			{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 },
			{ expense_date: '2026-06-01', raw_category: '晚餐', amount: 350 },
			{ expense_date: '2026-06-02', raw_category: '午餐', amount: 180 }
		];
		const results = records.map((r) => classifyRecord(r, existing));
		expect(results.filter((r) => r.status === 'duplicate')).toHaveLength(2);
		expect(results.filter((r) => r.status === 'update')).toHaveLength(1);
		const update = results.find((r) => r.status === 'update')!;
		expect(update.existingAmount).toBe(350);
	});
});

describe('commit resolution logic', () => {
	/** Simulate commit counting for a set of preview records. */
	function countCommit(records: PreviewRecord[]) {
		let inserted = 0, duplicates = 0, updated = 0, skipped = 0;
		for (const pr of records) {
			if (pr.status === 'duplicate') { duplicates++; continue; }
			if (pr.status === 'new') { inserted++; continue; }
			const res = pr.resolution ?? 'skip';
			if (res === 'use_new') updated++;
			else skipped++;
		}
		return { inserted, duplicates, updated, skipped };
	}

	it('counts new records as inserted', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord(), status: 'new' },
			{ record: makeRecord({ raw_category: '晚餐' }), status: 'new' }
		];
		const result = countCommit(records);
		expect(result).toEqual({ inserted: 2, duplicates: 0, updated: 0, skipped: 0 });
	});

	it('counts duplicates as duplicates', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord(), status: 'duplicate' }
		];
		expect(countCommit(records).duplicates).toBe(1);
	});

	it('counts use_new updates as updated', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord({ amount: 250 }), status: 'update', existingAmount: 200, resolution: 'use_new' }
		];
		expect(countCommit(records).updated).toBe(1);
	});

	it('counts keep_old as skipped', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord({ amount: 250 }), status: 'update', existingAmount: 200, resolution: 'keep_old' }
		];
		expect(countCommit(records).skipped).toBe(1);
	});

	it('counts skip resolution as skipped', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord({ amount: 250 }), status: 'update', existingAmount: 200, resolution: 'skip' }
		];
		expect(countCommit(records).skipped).toBe(1);
	});

	it('defaults missing resolution to skip', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord({ amount: 250 }), status: 'update', existingAmount: 200 }
		];
		expect(countCommit(records).skipped).toBe(1);
	});

	it('mixed scenario counts correctly', () => {
		const records: PreviewRecord[] = [
			{ record: makeRecord({ raw_category: 'A' }), status: 'new' },
			{ record: makeRecord({ raw_category: 'B' }), status: 'new' },
			{ record: makeRecord({ raw_category: 'C' }), status: 'duplicate' },
			{ record: makeRecord({ raw_category: 'D', amount: 300 }), status: 'update', existingAmount: 200, resolution: 'use_new' },
			{ record: makeRecord({ raw_category: 'E', amount: 400 }), status: 'update', existingAmount: 350, resolution: 'keep_old' }
		];
		expect(countCommit(records)).toEqual({ inserted: 2, duplicates: 1, updated: 1, skipped: 1 });
	});
});

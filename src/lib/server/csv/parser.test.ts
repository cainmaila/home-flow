import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, _parseCSVRow, _parseMDDate, _parseAmount } from './parser';
import { parseAndValidate } from './validator';
import { normalizeRecords } from './normalize';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the actual sample CSV
const sampleCSV = readFileSync(resolve(__dirname, '../../../../docs/費用.csv'), 'utf-8');

describe('parseCSVRow', () => {
	it('splits simple comma-separated values', () => {
		expect(_parseCSVRow('a,b,c')).toEqual(['a', 'b', 'c']);
	});

	it('handles quoted fields with commas', () => {
		expect(_parseCSVRow('午餐,245,"5,881"')).toEqual(['午餐', '245', '5,881']);
	});

	it('handles empty fields', () => {
		expect(_parseCSVRow(',,')).toEqual(['', '', '']);
	});

	it('handles escaped quotes', () => {
		expect(_parseCSVRow('"a""b",c')).toEqual(['a"b', 'c']);
	});
});

describe('parseMDDate', () => {
	it('parses M/D format', () => {
		expect(_parseMDDate('6/1', 2026)).toBe('2026-06-01');
		expect(_parseMDDate('5/18', 2026)).toBe('2026-05-18');
		expect(_parseMDDate('12/31', 2025)).toBe('2025-12-31');
	});

	it('returns null for invalid dates', () => {
		expect(_parseMDDate('13/1', 2026)).toBeNull();
		expect(_parseMDDate('2/30', 2026)).toBeNull();
		expect(_parseMDDate('abc', 2026)).toBeNull();
		expect(_parseMDDate('', 2026)).toBeNull();
	});
});

describe('parseAmount', () => {
	it('parses plain numbers', () => {
		expect(_parseAmount('100')).toBe(100);
		expect(_parseAmount('50')).toBe(50);
	});

	it('parses numbers with thousands commas', () => {
		expect(_parseAmount('5,881')).toBe(5881);
		expect(_parseAmount('1,930')).toBe(1930);
	});

	it('returns null for empty/blank', () => {
		expect(_parseAmount('')).toBeNull();
		expect(_parseAmount('  ')).toBeNull();
	});
});

describe('parseCSV with sample file', () => {
	const result = parseCSV(sampleCSV, 2026);

	it('extracts 31 date headers', () => {
		expect(result.dateHeaders).toHaveLength(31);
		expect(result.dateHeaders[0]).toBe('2026-05-18');
		expect(result.dateHeaders[result.dateHeaders.length - 1]).toBe('2026-06-17');
	});

	it('extracts 145 valid records', () => {
		expect(result.records).toHaveLength(145);
	});

	it('has correct category names', () => {
		const categories = [...new Set(result.records.map((r) => r.raw_category))];
		expect(categories).toContain('早餐');
		expect(categories).toContain('午餐');
		expect(categories).toContain('晚餐');
		expect(categories).toContain('消夜/零食');
		expect(categories).toContain('交-加油');
		expect(categories).toContain('醫療');
		expect(categories).toContain('食材');
		expect(categories).toContain('固-瓦斯640');
		expect(categories).toContain('彩券');
	});

	it('parses quoted thousands correctly', () => {
		// 午餐 last column total is "5,881" but that's the total column (excluded)
		// Check a data cell: 晚餐 on 5/26 should be 1930
		const dinner526 = result.records.find(
			(r) => r.raw_category === '晚餐' && r.expense_date === '2026-05-26'
		);
		expect(dinner526).toBeDefined();
		expect(dinner526!.amount).toBe(1930);

		// 交-加油 on 5/19 should be 1000
		const gas519 = result.records.find(
			(r) => r.raw_category === '交-加油' && r.expense_date === '2026-05-19'
		);
		expect(gas519).toBeDefined();
		expect(gas519!.amount).toBe(1000);
	});

	it('excludes last column totals from records', () => {
		// 午餐 total is 5881, but we should not have a record with that as amount on a non-date column
		// The 午餐 records should sum to 5881
		const lunchRecords = result.records.filter((r) => r.raw_category === '午餐');
		const lunchSum = lunchRecords.reduce((s, r) => s + r.amount, 0);
		expect(lunchSum).toBe(5881);
	});

	it('skips blank cells', () => {
		// 早餐 only has 3 records (5/23=325, 5/30=170, 6/6=275)
		const breakfastRecords = result.records.filter((r) => r.raw_category === '早餐');
		expect(breakfastRecords).toHaveLength(3);
		expect(breakfastRecords.map((r) => r.amount).sort((a, b) => a - b)).toEqual([
			170, 275, 325
		]);
	});

	it('does not include categories with all zeros (0 total)', () => {
		// 交通 has all empty cells and total 0 — no records
		const transport = result.records.filter((r) => r.raw_category === '交通');
		expect(transport).toHaveLength(0);
	});

	it('tracks category totals for cross-validation', () => {
		expect(result.categoryTotals.size).toBeGreaterThan(0);

		// 午餐: declared 5881, computed should also be 5881
		const lunch = result.categoryTotals.get('午餐');
		expect(lunch).toBeDefined();
		expect(lunch!.declared).toBe(5881);
		expect(lunch!.computed).toBe(5881);
	});
});

describe('parseAndValidate with sample file', () => {
	const result = parseAndValidate(sampleCSV, 2026);

	it('returns records', () => {
		expect(result.records).toHaveLength(145);
	});

	it('reports no blocking errors', () => {
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking).toHaveLength(0);
	});

	it('detects total mismatches as warnings', () => {
		const warnings = result.errors.filter((e) => e.severity === 'warning');
		// Some categories with 0 total but no data will match (0 === 0)
		// Categories where data doesn't match declared total produce warnings
		for (const w of warnings) {
			expect(w.message).toContain('total mismatch');
		}
	});
});

describe('edge cases', () => {
	it('handles CSV with fewer than 3 rows', () => {
		const result = parseAndValidate('row1\nrow2', 2026);
		expect(result.records).toHaveLength(0);
		expect(result.errors.some((e) => e.severity === 'blocking')).toBe(true);
	});

	it('handles empty CSV', () => {
		const result = parseAndValidate('', 2026);
		expect(result.records).toHaveLength(0);
	});
});

// --- T2.3: Column Semantic Recognition ---

/** Helper: build a transposed CSV from a simple spec */
function buildCSV(dates: string[], rows: { category: string; amounts: (number | null)[] }[]): string {
	const junkRow = '';
	const headerRow = ['', ...dates, ''].join(',');
	const dataRows = rows.map((r) => {
		const total = r.amounts.reduce((s: number, a) => s + (a ?? 0), 0);
		const cells = r.amounts.map((a) => (a === null ? '' : String(a)));
		return [r.category, ...cells, String(total)].join(',');
	});
	return [junkRow, headerRow, ...dataRows, '合計'].join('\n');
}

describe('T2.3: variable-shape CSV tolerance', () => {
	it('parses a CSV with fewer date columns', () => {
		const csv = buildCSV(['1/1', '1/2', '1/3'], [
			{ category: '午餐', amounts: [100, 200, null] },
			{ category: '晚餐', amounts: [null, 150, 300] }
		]);
		const result = parseCSV(csv, 2026);

		expect(result.dateHeaders).toHaveLength(3);
		expect(result.dateHeaders).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
		expect(result.records).toHaveLength(4); // 午餐: 100,200; 晚餐: 150,300
	});

	it('parses a CSV with more date columns', () => {
		const dates = Array.from({ length: 7 }, (_, i) => `3/${i + 1}`);
		const csv = buildCSV(dates, [
			{ category: '早餐', amounts: [50, null, 60, null, 70, null, 80] },
			{ category: '交通', amounts: [null, 100, null, 100, null, 100, null] }
		]);
		const result = parseCSV(csv, 2026);

		expect(result.dateHeaders).toHaveLength(7);
		expect(result.records).toHaveLength(7); // 4 breakfast + 3 transport
	});

	it('parses a CSV with different category names and row counts', () => {
		const csv = buildCSV(['7/10', '7/11'], [
			{ category: '咖啡', amounts: [65, 70] },
			{ category: '書籍', amounts: [350, null] },
			{ category: '固-網路', amounts: [null, 499] },
			{ category: '保險', amounts: [null, 2000] }
		]);
		const result = parseCSV(csv, 2026);

		expect(result.dateHeaders).toHaveLength(2);
		const categories = [...new Set(result.records.map((r) => r.raw_category))];
		expect(categories).toContain('咖啡');
		expect(categories).toContain('書籍');
		expect(categories).toContain('固-網路');
		expect(categories).toContain('保險');
		expect(result.records).toHaveLength(5); // 2+1+1+1
	});

	it('handles a single-date, single-category CSV', () => {
		const csv = buildCSV(['12/25'], [{ category: '禮物', amounts: [500] }]);
		const result = parseCSV(csv, 2025);

		expect(result.dateHeaders).toEqual(['2025-12-25']);
		expect(result.records).toHaveLength(1);
		expect(result.records[0]).toEqual({
			expense_date: '2025-12-25',
			raw_category: '禮物',
			amount: 500
		});
	});

	it('cross-validates totals on variable-shape CSV', () => {
		const csv = buildCSV(['2/1', '2/2'], [
			{ category: '飲料', amounts: [45, 55] }
		]);
		const result = parseCSV(csv, 2026);
		const totals = result.categoryTotals.get('飲料');
		expect(totals).toEqual({ declared: 100, computed: 100 });
	});
});

// --- T2.4: Standardize to Expense Model ---

describe('T2.4: normalizeRecords', () => {
	it('maps ParsedRecords to ExpenseRecords', () => {
		const parsed = [
			{ expense_date: '2026-06-01', raw_category: '午餐', amount: 200 },
			{ expense_date: '2026-06-01', raw_category: '晚餐', amount: 350 }
		];
		const records = normalizeRecords(parsed, 'hh-1');

		expect(records).toHaveLength(2);
		expect(records[0]).toEqual({
			household_id: 'hh-1',
			expense_date: '2026-06-01',
			raw_category: '午餐',
			normalized_category: null,
			amount: 200,
			is_fixed_expense: false,
			source_import_id: null
		});
	});

	it('sets is_fixed_expense for 固- prefix', () => {
		const parsed = [
			{ expense_date: '2026-06-01', raw_category: '固-瓦斯640', amount: 640 },
			{ expense_date: '2026-06-01', raw_category: '固-網路', amount: 499 }
		];
		const records = normalizeRecords(parsed, 'hh-1');

		expect(records[0].is_fixed_expense).toBe(true);
		expect(records[1].is_fixed_expense).toBe(true);
	});

	it('sets is_fixed_expense for known bill categories', () => {
		const billCategories = ['瓦斯', '水', '電', '保險', '貸款', '訂閱'];
		for (const cat of billCategories) {
			const records = normalizeRecords(
				[{ expense_date: '2026-01-01', raw_category: cat, amount: 100 }],
				'hh-1'
			);
			expect(records[0].is_fixed_expense).toBe(true);
		}
	});

	it('does not set is_fixed_expense for regular categories', () => {
		const regularCategories = ['午餐', '晚餐', '交通', '醫療', '飲料'];
		for (const cat of regularCategories) {
			const records = normalizeRecords(
				[{ expense_date: '2026-01-01', raw_category: cat, amount: 100 }],
				'hh-1'
			);
			expect(records[0].is_fixed_expense).toBe(false);
		}
	});

	it('sets normalized_category to null and source_import_id to null', () => {
		const records = normalizeRecords(
			[{ expense_date: '2026-06-01', raw_category: '午餐', amount: 100 }],
			'hh-1'
		);
		expect(records[0].normalized_category).toBeNull();
		expect(records[0].source_import_id).toBeNull();
	});

	it('works with real parser output', () => {
		const result = parseCSV(sampleCSV, 2026);
		const records = normalizeRecords(result.records, 'test-household');

		expect(records).toHaveLength(145);

		// All records should have the household_id
		expect(records.every((r) => r.household_id === 'test-household')).toBe(true);

		// 固-瓦斯640 should be fixed
		const gas = records.find((r) => r.raw_category === '固-瓦斯640');
		expect(gas).toBeDefined();
		expect(gas!.is_fixed_expense).toBe(true);

		// 午餐 should not be fixed
		const lunch = records.find((r) => r.raw_category === '午餐');
		expect(lunch).toBeDefined();
		expect(lunch!.is_fixed_expense).toBe(false);
	});
});

describe('T2.7: error classification', () => {
	it('bad date header → blocking', () => {
		const csv = 'junk\n,abc,6/2\n早餐,100,200';
		const result = parseAndValidate(csv, 2026);
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking.length).toBeGreaterThan(0);
		expect(blocking[0].message).toContain('Bad date header');
	});

	it('bad amount → blocking', () => {
		const csv = 'junk\n,6/1,6/2\n早餐,abc,200';
		const result = parseAndValidate(csv, 2026);
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking.length).toBeGreaterThan(0);
		expect(blocking[0].message).toContain('Bad amount');
	});

	it('empty category → blocking', () => {
		const csv = 'junk\n,6/1,6/2\n,100,200';
		const result = parseAndValidate(csv, 2026);
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking.length).toBeGreaterThan(0);
		expect(blocking[0].message).toContain('Empty category');
	});

	it('duplicate date header → warning', () => {
		const csv = 'junk\n,6/1,6/1,6/2\n早餐,100,200,300';
		const result = parseAndValidate(csv, 2026);
		const warnings = result.errors.filter((e) => e.severity === 'warning');
		expect(warnings.some((w) => w.message.includes('Duplicate date'))).toBe(true);
	});

	it('total mismatch → warning', () => {
		const csv = 'junk\n,6/1,6/2,total\n早餐,100,200,999';
		const result = parseAndValidate(csv, 2026);
		const warnings = result.errors.filter((e) => e.severity === 'warning');
		expect(warnings.some((w) => w.message.includes('total mismatch'))).toBe(true);
	});

	it('valid CSV has no blocking errors', () => {
		const result = parseAndValidate(sampleCSV, 2026);
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking).toHaveLength(0);
	});

	it('blocking errors prevent record output', () => {
		const csv = 'junk\n,abc\n早餐,100';
		const result = parseAndValidate(csv, 2026);
		expect(result.records).toHaveLength(0);
		expect(result.errors.some((e) => e.severity === 'blocking')).toBe(true);
	});
});

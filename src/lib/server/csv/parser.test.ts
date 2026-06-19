import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, _parseCSVRow, _parseMDDate, _parseAmount } from './parser';
import { parseAndValidate } from './validator';

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

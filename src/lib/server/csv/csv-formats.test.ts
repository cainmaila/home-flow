import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseCSV, parseCSVWithMapping } from './parser';
import { parseAndValidate } from './validator';

const YEAR = 2025;

function readCSV(filename: string): string {
	return readFileSync(resolve(__dirname, '../../../../docs', filename), 'utf-8');
}

describe('費用.csv (transposed format)', () => {
	const csv = readCSV('費用.csv');

	it('legacy parser extracts records', () => {
		const result = parseCSV(csv, YEAR);
		expect(result.records.length).toBeGreaterThan(0);
		expect(result.dateHeaders.length).toBeGreaterThan(0);
	});

	it('validator passes without blocking errors', () => {
		const result = parseAndValidate(csv, YEAR);
		const blocking = result.errors.filter((e) => e.severity === 'blocking');
		expect(blocking).toHaveLength(0);
		expect(result.records.length).toBeGreaterThan(0);
	});

	it('records have valid structure', () => {
		const result = parseCSV(csv, YEAR);
		for (const r of result.records) {
			expect(r.expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(r.raw_category).toBeTruthy();
			expect(typeof r.amount).toBe('number');
			expect(r.amount).toBeGreaterThan(0);
		}
	});

	it('finds expected categories', () => {
		const result = parseCSV(csv, YEAR);
		const cats = new Set(result.records.map((r) => r.raw_category));
		expect(cats.has('早餐')).toBe(true);
		expect(cats.has('午餐')).toBe(true);
	});
});

describe('費用b.csv (flat format — AI mapping mock)', () => {
	const csv = readCSV('費用b.csv');

	// Mock AI mapping: column indices from the header row
	// record_type(0), expense_date(1), period_start(2), period_end(3), raw_category(4), amount(5), is_fixed_expense(6), amount_source(7)
	const mapping = { dateCol: 1, categoryCol: 4, amountCol: 5, headerRow: 0 };

	it('parseCSVWithMapping extracts records', () => {
		const result = parseCSVWithMapping(csv, YEAR, mapping);
		expect(result.records.length).toBeGreaterThan(0);
	});

	it('records have valid structure', () => {
		const result = parseCSVWithMapping(csv, YEAR, mapping);
		for (const r of result.records) {
			expect(r.expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(r.raw_category).toBeTruthy();
			expect(typeof r.amount).toBe('number');
			expect(r.amount).toBeGreaterThan(0);
		}
	});

	it('finds expected categories', () => {
		const result = parseCSVWithMapping(csv, YEAR, mapping);
		const cats = new Set(result.records.map((r) => r.raw_category));
		expect(cats.has('早餐')).toBe(true);
		expect(cats.has('午餐')).toBe(true);
		expect(cats.has('彩券')).toBe(true);
	});

	it('parses correct record count', () => {
		const result = parseCSVWithMapping(csv, YEAR, mapping);
		// 費用b.csv has 173 data lines (174 total - 1 header)
		expect(result.records.length).toBe(173);
	});

	it('handles fixed expense categories', () => {
		const result = parseCSVWithMapping(csv, YEAR, mapping);
		const fixedCats = result.records.filter((r) => r.raw_category.startsWith('固-'));
		expect(fixedCats.length).toBeGreaterThan(0);
	});
});

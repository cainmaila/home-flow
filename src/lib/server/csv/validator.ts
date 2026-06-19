import {
	parseCSV,
	parseCSVWithMapping,
	_parseCSVRow as parseCSVRow,
	_parseMDDate as parseMDDate,
	type ParsedRecord,
	type ParseResult
} from './parser';
import { analyzeCSVStructure, type CSVMapping } from './ai-analyze';

export type Severity = 'blocking' | 'warning' | 'info';

export interface ParseError {
	severity: Severity;
	row?: number;
	column?: number;
	message: string;
}

export interface ValidationResult {
	records: ParsedRecord[];
	errors: ParseError[];
	format?: 'flat' | 'transposed';
}

/**
 * AI-assisted parse: analyze CSV structure with AI, then parse accordingly.
 * Falls back to legacy transposed parser if AI unavailable.
 */
export async function parseAndValidateAI(
	csv: string,
	year: number,
	apiKey?: string
): Promise<ValidationResult> {
	let mapping: CSVMapping | null = null;

	if (apiKey) {
		try {
			mapping = await analyzeCSVStructure(csv, apiKey);
		} catch (e) {
			console.warn('[CSV] AI analysis failed, falling back to legacy parser:', e);
		}
	}

	if (mapping?.format === 'flat' && mapping.dateCol !== undefined && mapping.categoryCol !== undefined && mapping.amountCol !== undefined) {
		return parseAndValidateFlat(csv, year, mapping);
	}

	// Fallback: legacy transposed parser
	return parseAndValidate(csv, year);
}

function parseAndValidateFlat(
	csv: string,
	year: number,
	mapping: CSVMapping
): ValidationResult {
	const errors: ParseError[] = [];

	let result: ParseResult;
	try {
		result = parseCSVWithMapping(csv, year, {
			dateCol: mapping.dateCol!,
			categoryCol: mapping.categoryCol!,
			amountCol: mapping.amountCol!,
			headerRow: mapping.headerRow ?? 0
		});
	} catch (e) {
		errors.push({ severity: 'blocking', message: `Parse failed: ${e}` });
		return { records: [], errors, format: 'flat' };
	}

	if (result.records.length === 0) {
		errors.push({ severity: 'warning', message: 'No expense records found' });
	}

	return { records: result.records, errors, format: 'flat' };
}

export function parseAndValidate(csv: string, year: number): ValidationResult {
	const errors: ParseError[] = [];

	const lines = csv.split(/\r?\n/);
	if (lines.length < 3) {
		errors.push({ severity: 'blocking', message: 'CSV has fewer than 3 rows' });
		return { records: [], errors, format: 'transposed' };
	}

	// Validate date headers (row 1) before full parse
	const headerCells = parseCSVRow(lines[1]);
	const seenDates = new Set<string>();
	for (let i = 1; i < headerCells.length - 1; i++) {
		const cell = headerCells[i].trim();
		if (!cell) continue;
		const iso = parseMDDate(cell, year);
		if (!iso) {
			errors.push({ severity: 'blocking', row: 2, column: i, message: `Bad date header: "${cell}"` });
		} else if (seenDates.has(iso)) {
			errors.push({ severity: 'warning', row: 2, column: i, message: `Duplicate date header: ${iso}` });
		} else {
			seenDates.add(iso);
		}
	}

	// Validate data rows (row 2+) for empty categories and bad amounts
	for (let r = 2; r < lines.length; r++) {
		const line = lines[r].trim();
		if (!line) continue;
		const cells = parseCSVRow(lines[r]);
		const category = cells[0]?.trim();
		if (category === '合計') break;

		if (!category) {
			errors.push({ severity: 'blocking', row: r + 1, message: 'Empty category name' });
			continue;
		}

		for (let i = 1; i < cells.length - 1; i++) {
			const raw = cells[i]?.trim();
			if (!raw) continue;
			const cleaned = raw.replace(/,/g, '');
			const num = Number(cleaned);
			if (!Number.isFinite(num)) {
				errors.push({
					severity: 'blocking',
					row: r + 1,
					column: i,
					message: `Bad amount "${raw}" in category "${category}"`
				});
			}
		}
	}

	if (errors.some((e) => e.severity === 'blocking')) {
		return { records: [], errors, format: 'transposed' };
	}

	let result: ParseResult;
	try {
		result = parseCSV(csv, year);
	} catch (e) {
		errors.push({ severity: 'blocking', message: `Parse failed: ${e}` });
		return { records: [], errors, format: 'transposed' };
	}

	if (result.dateHeaders.length === 0) {
		errors.push({ severity: 'blocking', message: 'No valid date headers found in row 2' });
	}

	if (result.records.length === 0 && errors.length === 0) {
		errors.push({ severity: 'warning', message: 'No expense records found' });
	}

	for (const [category, { declared, computed }] of result.categoryTotals) {
		if (declared !== computed) {
			errors.push({
				severity: 'warning',
				message: `Category "${category}" total mismatch: declared ${declared}, computed ${computed}`
			});
		}
	}

	return { records: result.records, errors, format: 'transposed' };
}

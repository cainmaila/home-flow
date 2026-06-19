import { parseCSV, type ParsedRecord, type ParseResult } from './parser';

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
}

/**
 * Parse and validate CSV content.
 * Returns records + errors with severity levels per Data-Rules section 7.
 */
export function parseAndValidate(csv: string, year: number): ValidationResult {
	const errors: ParseError[] = [];

	const lines = csv.split(/\r?\n/);
	if (lines.length < 3) {
		errors.push({ severity: 'blocking', message: 'CSV has fewer than 3 rows' });
		return { records: [], errors };
	}

	let result: ParseResult;
	try {
		result = parseCSV(csv, year);
	} catch (e) {
		errors.push({ severity: 'blocking', message: `Parse failed: ${e}` });
		return { records: [], errors };
	}

	if (result.dateHeaders.length === 0) {
		errors.push({ severity: 'blocking', message: 'No valid date headers found in row 2' });
	}

	if (result.records.length === 0 && errors.length === 0) {
		errors.push({ severity: 'warning', message: 'No expense records found' });
	}

	// Cross-validate row totals
	for (const [category, { declared, computed }] of result.categoryTotals) {
		if (declared !== computed) {
			errors.push({
				severity: 'warning',
				message: `Category "${category}" total mismatch: declared ${declared}, computed ${computed}`
			});
		}
	}

	return { records: result.records, errors };
}

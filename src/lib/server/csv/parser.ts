export interface ParsedRecord {
	expense_date: string; // ISO date: YYYY-MM-DD
	raw_category: string;
	amount: number; // integer NTD
}

/**
 * Parse a row of CSV text respecting quoted fields.
 * Handles: `a,"b,c",d` -> ['a', 'b,c', 'd']
 */
function parseCSVRow(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++; // skip escaped quote
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			cells.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	cells.push(current);
	return cells;
}

/**
 * Parse M/D date string into ISO date with given year.
 * Returns null if invalid.
 */
function parseMDDate(md: string, year: number): string | null {
	const trimmed = md.trim();
	const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
	if (!match) return null;

	const month = parseInt(match[1], 10);
	const day = parseInt(match[2], 10);
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;

	// Validate by constructing a Date and checking it round-trips
	const d = new Date(year, month - 1, day);
	if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
		return null;
	}

	const mm = String(month).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

/**
 * Parse an amount string into an integer NTD value.
 * Handles: "5,881" -> 5881, "100" -> 100, blank -> null
 * Returns null for blank/empty, throws for non-numeric.
 */
function parseAmount(raw: string): number | null {
	const trimmed = raw.trim();
	if (trimmed === '') return null;

	// Remove thousands commas
	const cleaned = trimmed.replace(/,/g, '');
	const num = Number(cleaned);
	if (!Number.isFinite(num)) return null; // caller decides error vs skip
	return num;
}

export interface ParseResult {
	records: ParsedRecord[];
	dateHeaders: string[]; // ISO dates parsed from header row
	categoryTotals: Map<string, { declared: number; computed: number }>;
}

/**
 * Parse the transposed CSV format used by Home Flow.
 *
 * Structure:
 * - Row 0: junk (skip)
 * - Row 1: date headers — first cell label/empty, then M/D dates, last column empty or total label
 * - Row 2+: category rows — first cell = category, then amounts per date, last column = row total
 * - Stop at "合計" row (totals row)
 *
 * @param csv  Raw CSV string
 * @param year Year to apply to M/D dates
 */
export function parseCSV(csv: string, year: number): ParseResult {
	const lines = csv.split(/\r?\n/);
	if (lines.length < 3) {
		return { records: [], dateHeaders: [], categoryTotals: new Map() };
	}

	// Row 0: skip (junk)
	// Row 1: date headers
	const headerCells = parseCSVRow(lines[1]);

	// Find date columns: indices where the header parses as M/D
	// First cell (index 0) is label/empty, last cell with no valid date is the total column
	const dateIndices: number[] = [];
	const dateHeaders: string[] = [];

	for (let i = 1; i < headerCells.length; i++) {
		const iso = parseMDDate(headerCells[i], year);
		if (iso) {
			dateIndices.push(i);
			dateHeaders.push(iso);
		}
	}

	const records: ParsedRecord[] = [];
	const categoryTotals = new Map<string, { declared: number; computed: number }>();

	// Parse data rows starting from row 2
	for (let r = 2; r < lines.length; r++) {
		const line = lines[r].trim();
		if (!line) continue;

		const cells = parseCSVRow(lines[r]);
		const category = cells[0]?.trim();

		// Stop at totals row
		if (category === '合計') break;

		if (!category) continue;

		// The last column (after all date columns) is the row total
		// Find it: it's the last non-date column with content
		const lastColIndex = cells.length - 1;
		const declaredTotal = parseAmount(cells[lastColIndex] ?? '');

		let computedTotal = 0;

		for (let d = 0; d < dateIndices.length; d++) {
			const colIdx = dateIndices[d];
			const rawAmount = cells[colIdx] ?? '';
			const amount = parseAmount(rawAmount);
			if (amount === null) continue;

			records.push({
				expense_date: dateHeaders[d],
				raw_category: category,
				amount
			});
			computedTotal += amount;
		}

		if (declaredTotal !== null) {
			categoryTotals.set(category, { declared: declaredTotal, computed: computedTotal });
		}
	}

	return { records, dateHeaders, categoryTotals };
}

/**
 * Parse CSV using an AI-provided column mapping.
 * AI tells us which columns are date, category, amount — we just follow.
 */
export function parseCSVWithMapping(
	csv: string,
	year: number,
	mapping: { dateCol: number; categoryCol: number; amountCol: number; headerRow: number }
): ParseResult {
	const lines = csv.split(/\r?\n/);
	const records: ParsedRecord[] = [];
	const dateSet = new Set<string>();

	for (let i = mapping.headerRow + 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		const cells = parseCSVRow(line);

		const dateStr = cells[mapping.dateCol]?.trim();
		const category = cells[mapping.categoryCol]?.trim();
		const amount = parseAmount(cells[mapping.amountCol] ?? '');

		if (!dateStr || !category || amount === null) continue;

		const iso = parseMDDate(dateStr, year);
		if (!iso) continue;

		dateSet.add(iso);
		records.push({ expense_date: iso, raw_category: category, amount });
	}

	return { records, dateHeaders: [...dateSet].sort(), categoryTotals: new Map() };
}

// Re-export for testing
export { parseCSVRow as _parseCSVRow, parseMDDate as _parseMDDate, parseAmount as _parseAmount };

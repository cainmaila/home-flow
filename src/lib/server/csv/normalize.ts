import type { ParsedRecord } from './parser';

export interface ExpenseRecord {
	household_id: string;
	expense_date: string; // ISO date
	raw_category: string;
	normalized_category: string | null; // null until category resolution (T3.x)
	amount: number; // integer NTD
	is_fixed_expense: boolean;
	source_import_id: string | null; // set during import commit
}

/** Known bill categories that are always fixed expenses (Data-Rules §5.1) */
const FIXED_BILL_CATEGORIES = new Set(['瓦斯', '水', '電', '保險', '貸款', '訂閱']);

function isFixedExpense(rawCategory: string): boolean {
	if (rawCategory.startsWith('固-')) return true;
	// Check if category (without any prefix) matches a known bill category
	return FIXED_BILL_CATEGORIES.has(rawCategory);
}

export function normalizeRecords(parsed: ParsedRecord[], householdId: string): ExpenseRecord[] {
	return parsed.map((r) => ({
		household_id: householdId,
		expense_date: r.expense_date,
		raw_category: r.raw_category,
		normalized_category: null,
		amount: r.amount,
		is_fixed_expense: isFixedExpense(r.raw_category),
		source_import_id: null
	}));
}

import type { ParsedRecord } from './parser';

export interface ExpenseRecord {
	household_id: string;
	expense_date: string; // ISO date
	raw_category: string;
	normalized_category: string | null; // null until category resolution (T3.x)
	amount: number; // integer NTD
	source_import_id: string | null; // set during import commit
	auto_tags?: string[];
}

const FIXED_BILL_CATEGORIES = new Set(['瓦斯', '水', '電', '保險', '貸款', '訂閱']);

export function getAutoTags(rawCategory: string): string[] {
	if (rawCategory.startsWith('固-') || FIXED_BILL_CATEGORIES.has(rawCategory)) return ['固定'];
	return [];
}

export function normalizeRecords(parsed: ParsedRecord[], householdId: string): ExpenseRecord[] {
	return parsed.map((r) => {
		const autoTags = getAutoTags(r.raw_category);
		return {
			household_id: householdId,
			expense_date: r.expense_date,
			raw_category: r.raw_category,
			normalized_category: null,
			amount: r.amount,
			source_import_id: null,
			...(autoTags.length > 0 ? { auto_tags: autoTags } : {})
		};
	});
}

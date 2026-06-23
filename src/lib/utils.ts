import type { CategoryParent } from './types';

export const HOUSEHOLD_ID = 'default';

export function formatAmount(cents: number): string {
	return Math.round(cents).toLocaleString('zh-TW');
}

export function buildCategoryColorMap(categories: CategoryParent[]): Map<number, string> {
	const m = new Map<number, string>();
	for (const g of categories) for (const c of g.children) if (c.color) m.set(c.id, c.color);
	return m;
}

// 依明細(完全相同)查最近一筆已分類的 category_id，查無回 null
export async function fetchCategoryByDetail(detail: string): Promise<number | null> {
	if (!detail.trim()) return null;
	try {
		const res = await fetch(`/api/expenses/category-by-detail?detail=${encodeURIComponent(detail.trim())}`);
		if (!res.ok) return null;
		const r = await res.json() as { category_id: number | null };
		return r.category_id;
	} catch {
		return null;
	}
}

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

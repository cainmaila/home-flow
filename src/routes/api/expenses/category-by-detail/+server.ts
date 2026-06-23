import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

// 依明細文字（完全相同）找最近一筆已分類的支出，供新增時自動帶入分類
export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const detail = (url.searchParams.get('detail') ?? '').trim();
	if (!detail) return json({ category_id: null, category_name: null });

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const row = await db
		.prepare(
			`SELECT e.category_id, c.name AS category_name
			 FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
			 WHERE e.household_id = ? AND e.detail = ? AND e.category_id IS NOT NULL
			 ORDER BY e.expense_date DESC
			 LIMIT 1`
		)
		.bind(HOUSEHOLD_ID, detail)
		.first<{ category_id: number; category_name: string | null }>();

	return json({ category_id: row?.category_id ?? null, category_name: row?.category_name ?? null });
};

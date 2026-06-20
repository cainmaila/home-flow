import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const monthCount = Math.min(Math.max(parseInt(url.searchParams.get('months') ?? '6') || 6, 2), 24);

	const monthsResult = await db
		.prepare(
			`SELECT DISTINCT strftime('%Y-%m', expense_date) as month
			 FROM expenses WHERE household_id = ?
			 ORDER BY month DESC
			 LIMIT ?`
		)
		.bind(HOUSEHOLD_ID, monthCount)
		.all<{ month: string }>();

	const months = monthsResult.results.map((r) => r.month).reverse();

	if (months.length === 0) {
		return json({ months: [], data: [] });
	}

	const startMonth = months[0];

	const result = await db
		.prepare(
			`SELECT strftime('%Y-%m', e.expense_date) AS month,
			        COALESCE(p.name, c.name, '未分類') AS big_category,
			        SUM(e.amount) AS total
			 FROM expenses e
			 LEFT JOIN categories c ON e.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE e.household_id = ?
			   AND strftime('%Y-%m', e.expense_date) >= ?
			 GROUP BY month, big_category`
		)
		.bind(HOUSEHOLD_ID, startMonth)
		.all<{ month: string; big_category: string; total: number }>();

	return json({ months, data: result.results });
};

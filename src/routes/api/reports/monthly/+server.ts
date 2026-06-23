import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const monthsResult = await db
		.prepare(
			`SELECT DISTINCT strftime('%Y-%m', expense_date) as month
			 FROM expenses WHERE household_id = ?
			 ORDER BY month DESC`
		)
		.bind(HOUSEHOLD_ID)
		.all<{ month: string }>();

	const availableMonths = monthsResult.results.map((r) => r.month);

	if (availableMonths.length === 0) {
		return json({ month: null, totalExpense: 0, categoryBreakdown: [], availableMonths: [] });
	}

	const month = url.searchParams.get('month') ?? availableMonths[0];

	const totalResult = await db
		.prepare(
			`SELECT SUM(amount) as total
			 FROM expenses WHERE household_id = ? AND strftime('%Y-%m', expense_date) = ?`
		)
		.bind(HOUSEHOLD_ID, month)
		.first<{ total: number | null }>();

	const totalExpense = totalResult?.total ?? 0;

	// Category breakdown: join categories for name, group by parent
	const categoryResult = await db
		.prepare(
			`SELECT
			   COALESCE(c.name, e.raw_category) as category,
			   COALESCE(p.name, '未分類') as parent_category,
			   c.id as category_id,
			   p.id as parent_id,
			   SUM(e.amount) as total
			 FROM expenses e
			 LEFT JOIN categories c ON e.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE e.household_id = ? AND strftime('%Y-%m', e.expense_date) = ?
			 GROUP BY COALESCE(c.id, e.raw_category)
			 ORDER BY total DESC`
		)
		.bind(HOUSEHOLD_ID, month)
		.all<{
			category: string;
			parent_category: string;
			category_id: number | null;
			parent_id: number | null;
			total: number;
		}>();

	const categoryBreakdown = categoryResult.results.map((r) => ({
		category: r.category,
		parent_category: r.parent_category,
		category_id: r.category_id,
		parent_id: r.parent_id,
		total: r.total,
		percentage: totalExpense > 0 ? Math.round((r.total / totalExpense) * 1000) / 10 : 0
	}));

	const paymentResult = await db
		.prepare(
			`SELECT payment_method AS method, SUM(amount) AS total
			 FROM expenses
			 WHERE household_id = ? AND strftime('%Y-%m', expense_date) = ?
			 GROUP BY payment_method ORDER BY total DESC`
		)
		.bind(HOUSEHOLD_ID, month)
		.all<{ method: string; total: number }>();

	const paymentBreakdown = paymentResult.results.map((r) => ({
		method: r.method,
		total: r.total,
		percentage: totalExpense > 0 ? Math.round((r.total / totalExpense) * 1000) / 10 : 0
	}));

	return json({ month, totalExpense, categoryBreakdown, paymentBreakdown, availableMonths });
};

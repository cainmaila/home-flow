import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	// Get available months
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

	// Total expense for the month
	const totalResult = await db
		.prepare(
			`SELECT SUM(amount) as total
			 FROM expenses WHERE household_id = ? AND strftime('%Y-%m', expense_date) = ?`
		)
		.bind(HOUSEHOLD_ID, month)
		.first<{ total: number | null }>();

	const totalExpense = totalResult?.total ?? 0;

	// Category breakdown
	const categoryResult = await db
		.prepare(
			`SELECT COALESCE(normalized_category, raw_category) as category, SUM(amount) as total
			 FROM expenses WHERE household_id = ? AND strftime('%Y-%m', expense_date) = ?
			 GROUP BY category ORDER BY total DESC`
		)
		.bind(HOUSEHOLD_ID, month)
		.all<{ category: string; total: number }>();

	const categoryBreakdown = categoryResult.results.map((r) => ({
		category: r.category,
		total: r.total,
		percentage: totalExpense > 0 ? Math.round((r.total / totalExpense) * 1000) / 10 : 0
	}));

	return json({ month, totalExpense, categoryBreakdown, availableMonths });
};

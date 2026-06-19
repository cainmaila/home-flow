import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const result = await db
		.prepare(
			`SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
			 FROM expenses WHERE household_id = ?
			 GROUP BY month ORDER BY month ASC`
		)
		.bind(HOUSEHOLD_ID)
		.all<{ month: string; total: number }>();

	const months = result.results;

	let comparison = null;
	if (months.length >= 2) {
		const current = months[months.length - 1];
		const previous = months[months.length - 2];
		const diff = current.total - previous.total;
		const diffPercent = previous.total > 0 ? Math.round((diff / previous.total) * 1000) / 10 : 0;
		comparison = {
			currentMonth: current.month,
			previousMonth: previous.month,
			currentTotal: current.total,
			previousTotal: previous.total,
			diff,
			diffPercent
		};
	}

	return json({ months, comparison });
};

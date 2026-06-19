import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const month = url.searchParams.get('month');
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const category = url.searchParams.get('category');
	const fixed = url.searchParams.get('fixed');

	const conditions: string[] = ['household_id = ?'];
	const binds: (string | number)[] = [HOUSEHOLD_ID];

	if (month) {
		conditions.push("strftime('%Y-%m', expense_date) = ?");
		binds.push(month);
	}
	if (dateFrom) {
		conditions.push('expense_date >= ?');
		binds.push(dateFrom);
	}
	if (dateTo) {
		conditions.push('expense_date <= ?');
		binds.push(dateTo);
	}
	if (category) {
		conditions.push('COALESCE(normalized_category, raw_category) = ?');
		binds.push(category);
	}
	if (fixed === 'true' || fixed === 'false') {
		conditions.push('is_fixed_expense = ?');
		binds.push(fixed === 'true' ? 1 : 0);
	}

	const where = conditions.join(' AND ');

	const countResult = await db
		.prepare(`SELECT COUNT(*) as count, SUM(amount) as total FROM expenses WHERE ${where}`)
		.bind(...binds)
		.first<{ count: number; total: number | null }>();

	const rows = await db
		.prepare(
			`SELECT id, expense_date, raw_category, normalized_category, amount, is_fixed_expense
			 FROM expenses WHERE ${where}
			 ORDER BY expense_date DESC, raw_category ASC`
		)
		.bind(...binds)
		.all<{
			id: string;
			expense_date: string;
			raw_category: string;
			normalized_category: string | null;
			amount: number;
			is_fixed_expense: number;
		}>();

	const expenses = rows.results.map((r) => ({
		id: r.id,
		expense_date: r.expense_date,
		raw_category: r.raw_category,
		normalized_category: r.normalized_category ?? r.raw_category,
		amount: r.amount,
		is_fixed_expense: r.is_fixed_expense === 1
	}));

	return json({
		expenses,
		total: countResult?.total ?? 0,
		count: countResult?.count ?? 0
	});
};

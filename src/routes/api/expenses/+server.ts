import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		expense_date: string;
		amount: number;
		category_id: number;
		is_fixed_expense?: boolean;
	};

	if (!body.expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date))
		throw error(400, 'Invalid date format');
	if (typeof body.amount !== 'number' || body.amount <= 0)
		throw error(400, 'Invalid amount');
	if (typeof body.category_id !== 'number')
		throw error(400, 'Category required');

	const cat = await db
		.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
		.bind(body.category_id, HOUSEHOLD_ID)
		.first();
	if (!cat) throw error(400, 'Invalid category');

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO expenses (id, household_id, expense_date, raw_category, category_id, amount, is_fixed_expense)
			 VALUES (?, ?, ?, '手動輸入', ?, ?, ?)`
		)
		.bind(
			id,
			HOUSEHOLD_ID,
			body.expense_date,
			body.category_id,
			body.amount,
			body.is_fixed_expense ? 1 : 0
		)
		.run();

	return json({ id });
};

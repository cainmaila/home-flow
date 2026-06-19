import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const expense = await db
		.prepare('SELECT id FROM expenses WHERE id = ? AND household_id = ?')
		.bind(params.id, HOUSEHOLD_ID)
		.first();
	if (!expense) throw error(404, 'Expense not found');

	const body = (await request.json()) as {
		expense_date?: string;
		amount?: number;
		category_id?: number | null;
		is_fixed_expense?: boolean;
	};

	const sets: string[] = [];
	const vals: unknown[] = [];

	if (body.expense_date !== undefined) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date)) throw error(400, 'Invalid date format');
		sets.push('expense_date = ?');
		vals.push(body.expense_date);
	}
	if (body.amount !== undefined) {
		if (typeof body.amount !== 'number' || body.amount < 0) throw error(400, 'Invalid amount');
		sets.push('amount = ?');
		vals.push(body.amount);
	}
	if (body.category_id !== undefined) {
		sets.push('category_id = ?');
		vals.push(body.category_id);
	}
	if (body.is_fixed_expense !== undefined) {
		sets.push('is_fixed_expense = ?');
		vals.push(body.is_fixed_expense ? 1 : 0);
	}

	if (sets.length === 0) throw error(400, 'Nothing to update');

	sets.push("updated_at = datetime('now')");
	vals.push(params.id, HOUSEHOLD_ID);

	await db
		.prepare(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ? AND household_id = ?`)
		.bind(...vals)
		.run();

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const expense = await db
		.prepare('SELECT id FROM expenses WHERE id = ? AND household_id = ?')
		.bind(params.id, HOUSEHOLD_ID)
		.first();
	if (!expense) throw error(404, 'Expense not found');

	await db
		.prepare('DELETE FROM expenses WHERE id = ? AND household_id = ?')
		.bind(params.id, HOUSEHOLD_ID)
		.run();

	return json({ ok: true });
};

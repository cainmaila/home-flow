import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';

/** POST: create a category override for a specific expense. */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const user = requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		householdId?: string;
		expenseId?: string;
		categoryId?: number;
	};

	const householdId = body.householdId;
	const expenseId = body.expenseId;
	const categoryId = body.categoryId;

	if (!householdId) throw error(400, 'Missing householdId');
	if (!expenseId) throw error(400, 'Missing expenseId');
	if (!categoryId) throw error(400, 'Missing categoryId');

	const expense = await db
		.prepare(`SELECT category_id FROM expenses WHERE id = ? AND household_id = ?`)
		.bind(expenseId, householdId)
		.first<{ category_id: number | null }>();

	if (!expense) throw error(404, 'Expense not found');

	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO category_overrides (id, household_id, expense_id, field, old_value, new_value, category_id, created_by)
			 VALUES (?, ?, ?, 'category', ?, ?, ?, ?)`
		)
		.bind(id, householdId, expenseId, expense.category_id?.toString() ?? null, categoryId.toString(), categoryId, user.email)
		.run();

	await db
		.prepare(
			`UPDATE expenses SET category_id = ?, updated_at = datetime('now')
			 WHERE id = ?`
		)
		.bind(categoryId, expenseId)
		.run();

	return json({ ok: true });
};

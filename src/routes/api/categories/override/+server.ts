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
		newCategory?: string;
	};

	const householdId = body.householdId;
	const expenseId = body.expenseId;
	const newCategory = body.newCategory;

	if (!householdId) throw error(400, 'Missing householdId');
	if (!expenseId) throw error(400, 'Missing expenseId');
	if (!newCategory) throw error(400, 'Missing newCategory');

	// Get current category for old_value
	const expense = await db
		.prepare(`SELECT normalized_category FROM expenses WHERE id = ? AND household_id = ?`)
		.bind(expenseId, householdId)
		.first<{ normalized_category: string | null }>();

	if (!expense) throw error(404, 'Expense not found');

	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO category_overrides (id, household_id, expense_id, field, old_value, new_value, created_by)
			 VALUES (?, ?, ?, 'category', ?, ?, ?)`
		)
		.bind(id, householdId, expenseId, expense.normalized_category, newCategory, user.email)
		.run();

	// Update the expense record immediately
	await db
		.prepare(
			`UPDATE expenses SET normalized_category = ?, updated_at = datetime('now')
			 WHERE id = ?`
		)
		.bind(newCategory, expenseId)
		.run();

	return json({ ok: true });
};

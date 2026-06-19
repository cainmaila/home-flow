import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';

/** POST: override is_fixed_expense for a specific expense. */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const user = requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		householdId?: string;
		expenseId?: string;
		isFixedExpense?: boolean;
	};

	const householdId = body.householdId;
	const expenseId = body.expenseId;
	const isFixedExpense = body.isFixedExpense;

	if (!householdId) throw error(400, 'Missing householdId');
	if (!expenseId) throw error(400, 'Missing expenseId');
	if (typeof isFixedExpense !== 'boolean') throw error(400, 'Missing isFixedExpense');

	// Verify expense exists
	const expense = await db
		.prepare(`SELECT id FROM expenses WHERE id = ? AND household_id = ?`)
		.bind(expenseId, householdId)
		.first<{ id: string }>();

	if (!expense) throw error(404, 'Expense not found');

	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO fixed_expense_overrides (id, household_id, expense_id, is_fixed_expense, created_by)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.bind(id, householdId, expenseId, isFixedExpense ? 1 : 0, user.email)
		.run();

	// Update the expense record immediately
	await db
		.prepare(
			`UPDATE expenses SET is_fixed_expense = ?, updated_at = datetime('now')
			 WHERE id = ?`
		)
		.bind(isFixedExpense ? 1 : 0, expenseId)
		.run();

	return json({ ok: true });
};

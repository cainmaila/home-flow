import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { rebuildInstallmentExpenses } from '$lib/server/installments';

const HOUSEHOLD_ID = 'default';

type InstRow = {
	id: string;
	household_id: string;
	total_amount: number;
	periods: number;
	start_month: string;
	category_id: number | null;
	detail: string | null;
	payment_method: string;
};

export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const inst = await db
		.prepare('SELECT * FROM installments WHERE id = ? AND household_id = ?')
		.bind(params.id, HOUSEHOLD_ID)
		.first<InstRow>();
	if (!inst) throw error(404, 'Installment not found');

	const body = (await request.json()) as {
		total_amount?: number;
		periods?: number;
		start_month?: string;
		category_id?: number | null;
		detail?: string | null;
		payment_method?: string;
	};

	if (body.total_amount !== undefined && (typeof body.total_amount !== 'number' || body.total_amount <= 0))
		throw error(400, 'Invalid total_amount');
	if (body.periods !== undefined && (typeof body.periods !== 'number' || !Number.isInteger(body.periods) || body.periods < 1))
		throw error(400, 'Invalid periods');
	if (body.start_month !== undefined && !/^\d{4}-\d{2}$/.test(body.start_month))
		throw error(400, 'Invalid start_month');

	const updated: InstRow = {
		...inst,
		total_amount: body.total_amount ?? inst.total_amount,
		periods: body.periods ?? inst.periods,
		start_month: body.start_month ?? inst.start_month,
		category_id: body.category_id !== undefined ? body.category_id : inst.category_id,
		detail: body.detail !== undefined ? (body.detail?.trim().slice(0, 200) || null) : inst.detail,
		payment_method: body.payment_method?.trim().slice(0, 20) || inst.payment_method
	};

	await db
		.prepare(
			`UPDATE installments SET total_amount=?, periods=?, start_month=?, category_id=?, detail=?, payment_method=?, updated_at=datetime('now')
			 WHERE id = ? AND household_id = ?`
		)
		.bind(updated.total_amount, updated.periods, updated.start_month, updated.category_id, updated.detail, updated.payment_method, params.id, HOUSEHOLD_ID)
		.run();

	await rebuildInstallmentExpenses(db, HOUSEHOLD_ID, updated);

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const inst = await db
		.prepare('SELECT id FROM installments WHERE id = ? AND household_id = ?')
		.bind(params.id, HOUSEHOLD_ID)
		.first();
	if (!inst) throw error(404, 'Installment not found');

	await db.batch([
		db
			.prepare(
				'DELETE FROM expense_tags WHERE expense_id IN (SELECT id FROM expenses WHERE installment_id = ?)'
			)
			.bind(params.id),
		db.prepare('DELETE FROM expenses WHERE installment_id = ?').bind(params.id),
		db
			.prepare('DELETE FROM installments WHERE id = ? AND household_id = ?')
			.bind(params.id, HOUSEHOLD_ID)
	]);

	return json({ ok: true });
};

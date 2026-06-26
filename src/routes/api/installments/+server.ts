import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { rebuildInstallmentExpenses } from '$lib/server/installments';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const rows = await db
		.prepare(
			`SELECT i.id, i.total_amount, i.periods, i.start_month, i.category_id,
			        i.detail, i.payment_method, i.created_at,
			        c.name as category_name, p.name as parent_category_name
			 FROM installments i
			 LEFT JOIN categories c ON i.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE i.household_id = ?
			 ORDER BY i.created_at DESC`
		)
		.bind(HOUSEHOLD_ID)
		.all();

	return json(rows.results);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		total_amount: number;
		periods: number;
		start_month: string;
		category_id?: number | null;
		detail?: string;
		payment_method?: string;
	};

	if (typeof body.total_amount !== 'number' || body.total_amount <= 0)
		throw error(400, 'Invalid total_amount');
	if (typeof body.periods !== 'number' || !Number.isInteger(body.periods) || body.periods < 1)
		throw error(400, 'Invalid periods');
	if (!body.start_month || !/^\d{4}-\d{2}$/.test(body.start_month))
		throw error(400, 'Invalid start_month');
	if (body.category_id != null) {
		const cat = await db
			.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
			.bind(body.category_id, HOUSEHOLD_ID)
			.first();
		if (!cat) throw error(400, 'Invalid category');
	}

	const id = crypto.randomUUID();
	const paymentMethod = body.payment_method?.trim().slice(0, 20) || '現金';
	const detail = body.detail?.trim().slice(0, 200) || null;

	await db
		.prepare(
			`INSERT INTO installments (id, household_id, total_amount, periods, start_month, category_id, detail, payment_method)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, HOUSEHOLD_ID, body.total_amount, body.periods, body.start_month, body.category_id ?? null, detail, paymentMethod)
		.run();

	await rebuildInstallmentExpenses(db, HOUSEHOLD_ID, {
		id,
		household_id: HOUSEHOLD_ID,
		total_amount: body.total_amount,
		periods: body.periods,
		start_month: body.start_month,
		category_id: body.category_id ?? null,
		detail,
		payment_method: paymentMethod
	});

	return json({ id });
};

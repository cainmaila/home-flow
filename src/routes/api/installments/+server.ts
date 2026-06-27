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
			        i.detail, i.tags, i.payment_method, i.created_at,
			        c.name as category_name, p.name as parent_category_name
			 FROM installments i
			 LEFT JOIN categories c ON i.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE i.household_id = ?
			 ORDER BY i.created_at DESC`
		)
		.bind(HOUSEHOLD_ID)
		.all<Record<string, unknown>>();

	return json(rows.results.map((r) => ({ ...r, tags: r.tags ? (r.tags as string).split(',') : [] })));
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
		tags?: string[];
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
	const tags = Array.isArray(body.tags) ? body.tags : [];

	try {
		await db
			.prepare(
				`INSERT INTO installments (id, household_id, total_amount, periods, start_month, category_id, detail, tags, payment_method)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(id, HOUSEHOLD_ID, body.total_amount, body.periods, body.start_month, body.category_id ?? null, detail, tags.length ? tags.join(',') : null, paymentMethod)
			.run();
	} catch (e) {
		console.error('[installments POST] INSERT installment failed:', e);
		throw error(500, `新增分期失敗: ${e instanceof Error ? e.message : String(e)}`);
	}

	try {
		await rebuildInstallmentExpenses(db, HOUSEHOLD_ID, {
			id,
			household_id: HOUSEHOLD_ID,
			total_amount: body.total_amount,
			periods: body.periods,
			start_month: body.start_month,
			category_id: body.category_id ?? null,
			detail,
			tags,
			payment_method: paymentMethod
		});
	} catch (e) {
		console.error('[installments POST] rebuildInstallmentExpenses failed:', e);
		throw error(500, `建立分期明細失敗: ${e instanceof Error ? e.message : String(e)}`);
	}

	return json({ id });
};

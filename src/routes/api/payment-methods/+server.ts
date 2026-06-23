import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, requireAdmin } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAuth(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const rows = await db
		.prepare('SELECT id, name FROM payment_methods WHERE household_id = ? ORDER BY sort_order, name')
		.bind(HOUSEHOLD_ID)
		.all<{ id: number; name: string }>();

	return json(rows.results);
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as { name?: string };
	const name = body.name?.trim();
	if (!name || name.length > 20) throw error(400, 'Name required (max 20 chars)');

	const maxOrder = await db
		.prepare('SELECT MAX(sort_order) as m FROM payment_methods WHERE household_id = ?')
		.bind(HOUSEHOLD_ID)
		.first<{ m: number | null }>();

	try {
		await db
			.prepare('INSERT INTO payment_methods (household_id, name, sort_order) VALUES (?, ?, ?)')
			.bind(HOUSEHOLD_ID, name, (maxOrder?.m ?? -1) + 1)
			.run();
	} catch {
		throw error(400, 'Payment method already exists');
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ url, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const id = url.searchParams.get('id');
	if (!id) throw error(400, 'Missing id');

	await db
		.prepare('DELETE FROM payment_methods WHERE id = ? AND household_id = ?')
		.bind(Number(id), HOUSEHOLD_ID)
		.run();

	return json({ ok: true });
};

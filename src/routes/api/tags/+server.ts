import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAuth(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const rows = await db
		.prepare('SELECT id, name FROM tags WHERE household_id = ? ORDER BY name')
		.bind(HOUSEHOLD_ID)
		.all<{ id: number; name: string }>();

	return json(rows.results);
};

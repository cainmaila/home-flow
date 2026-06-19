import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const rows = await db
		.prepare(
			`SELECT i.id, i.filename, i.status, i.parsed_rows, i.inserted_rows,
			        i.duplicate_rows, i.updated_rows, i.skipped_rows, i.warning_rows,
			        i.created_at, i.committed_at, u.email AS uploaded_by_email, u.name AS uploaded_by_name
			 FROM imports i
			 LEFT JOIN users u ON u.id = i.uploaded_by
			 ORDER BY i.created_at DESC`
		)
		.all();

	return json(rows.results);
};

/**
 * GET /api/ai/suggestions — List pending AI suggestions for review.
 * T5.4: Returns pending suggestions that need manual confirmation.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

export const GET: RequestHandler = async ({ locals, platform, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const status = url.searchParams.get('status') ?? 'pending';

	const rows = await db
		.prepare(
			`SELECT s.id, s.household_id, s.import_id, s.raw_category, s.suggested_category, s.confidence, s.status, s.created_at, s.resolved_at,
			        p.name as parent_name
			 FROM ai_suggestions s
			 LEFT JOIN categories c ON c.name = s.suggested_category AND c.parent_id IS NOT NULL AND c.is_deleted = 0
			 LEFT JOIN categories p ON p.id = c.parent_id
			 WHERE s.status = ?
			 ORDER BY s.created_at DESC`
		)
		.bind(status)
		.all();

	return json({ suggestions: rows.results });
};

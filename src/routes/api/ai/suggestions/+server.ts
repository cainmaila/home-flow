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
			`SELECT id, household_id, import_id, raw_category, suggested_category, confidence, status, created_at, resolved_at
			 FROM ai_suggestions
			 WHERE status = ?
			 ORDER BY created_at DESC`
		)
		.bind(status)
		.all();

	return json({ suggestions: rows.results });
};

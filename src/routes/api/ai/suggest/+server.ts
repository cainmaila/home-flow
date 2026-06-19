/**
 * POST /api/ai/suggest — Trigger AI category suggestions for unmatched categories.
 * T5.1: Requires admin + feature flag enabled.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { isAIEnabled } from '$lib/server/ai/config';
import { suggestCategories } from '$lib/server/ai/gemini';
import { isQuotaExceeded } from '$lib/server/ai/quota';
import { STANDARD_CATEGORIES } from '$lib/config/categories';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const env = platform?.env;
	if (!env) throw error(500, 'Platform not available');
	if (!isAIEnabled(env)) throw error(400, 'AI feature is disabled');
	if (isQuotaExceeded()) throw error(429, 'AI quota exceeded');

	const db = env.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as { householdId?: string };
	const householdId = body.householdId || 'default';

	const rows = await db
		.prepare(
			`SELECT DISTINCT e.raw_category
			 FROM expenses e
			 LEFT JOIN category_aliases ca
			   ON ca.household_id = e.household_id AND ca.raw_category = e.raw_category
			 LEFT JOIN ai_suggestions s
			   ON s.household_id = e.household_id AND s.raw_category = e.raw_category AND s.status = 'pending'
			 WHERE e.household_id = ?
			   AND e.normalized_category IS NULL
			   AND ca.id IS NULL
			   AND s.id IS NULL`
		)
		.bind(householdId)
		.all<{ raw_category: string }>();

	const unmatched = rows.results.map((r) => r.raw_category);

	if (unmatched.length === 0) {
		return json({ suggestions: [], message: 'No unmatched categories' });
	}

	const suggestions = await suggestCategories(
		unmatched,
		[...STANDARD_CATEGORIES],
		env.GOOGLE_AI_API_KEY!
	);

	for (const s of suggestions) {
		await db
			.prepare(
				`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, confidence, status)
				 VALUES (?, ?, '', ?, ?, ?, 'pending')
				 ON CONFLICT DO NOTHING`
			)
			.bind(crypto.randomUUID(), householdId, s.raw_category, s.suggested_category, s.confidence)
			.run();
	}

	return json({ suggestions });
};

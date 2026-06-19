import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { isAIEnabled } from '$lib/server/ai/config';
import { suggestCategories, loadCategoriesWithExamples } from '$lib/server/ai/gemini';
import { isQuotaExceeded } from '$lib/server/ai/quota';

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
			   AND e.category_id IS NULL
			   AND ca.id IS NULL
			   AND s.id IS NULL`
		)
		.bind(householdId)
		.all<{ raw_category: string }>();

	const unmatched = rows.results.map((r) => r.raw_category);

	if (unmatched.length === 0) {
		return json({ suggestions: [], message: 'No unmatched categories' });
	}

	const catsWithExamples = await loadCategoriesWithExamples(db, householdId);
	if (catsWithExamples.length === 0) {
		return json({ suggestions: [], message: 'No categories defined' });
	}

	// Build name→id lookup
	const catRows = await db
		.prepare(
			`SELECT id, name FROM categories
			 WHERE household_id = ? AND parent_id IS NOT NULL AND is_deleted = 0`
		)
		.bind(householdId)
		.all<{ id: number; name: string }>();

	const nameToId = new Map<string, number>();
	for (const r of catRows.results) {
		nameToId.set(r.name, r.id);
	}

	const suggestions = await suggestCategories(
		unmatched,
		[],
		env.GOOGLE_AI_API_KEY!,
		catsWithExamples
	);

	for (const s of suggestions) {
		const categoryId = nameToId.get(s.suggested_category);
		await db
			.prepare(
				`INSERT INTO ai_suggestions (id, household_id, import_id, raw_category, suggested_category, suggested_category_id, confidence, status)
				 VALUES (?, ?, '', ?, ?, ?, ?, 'pending')
				 ON CONFLICT DO NOTHING`
			)
			.bind(crypto.randomUUID(), householdId, s.raw_category, s.suggested_category, categoryId ?? null, s.confidence)
			.run();
	}

	return json({ suggestions });
};

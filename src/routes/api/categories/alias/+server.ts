import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, requireAuth } from '$lib/server/auth/guard';

/** GET: list all alias mappings for a household. */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const householdId = url.searchParams.get('householdId') ?? 'default';

	const rows = await db
		.prepare(
			`SELECT id, raw_category, normalized_category, source, created_at
			 FROM category_aliases
			 WHERE household_id = ?
			 ORDER BY created_at DESC`
		)
		.bind(householdId)
		.all<{
			id: string;
			raw_category: string;
			normalized_category: string;
			source: string;
			created_at: string;
		}>();

	return json(rows.results);
};

/** POST: create or update an alias mapping (manual source). */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		householdId?: string;
		rawCategory?: string;
		normalizedCategory?: string;
	};

	const householdId = body.householdId;
	const rawCategory = body.rawCategory;
	const normalizedCategory = body.normalizedCategory;

	if (!householdId) throw error(400, 'Missing householdId');
	if (!rawCategory) throw error(400, 'Missing rawCategory');
	if (!normalizedCategory) throw error(400, 'Missing normalizedCategory');

	const id = crypto.randomUUID();

	// UPSERT: if alias for this household+raw_category exists, update it
	await db
		.prepare(
			`INSERT INTO category_aliases (id, household_id, raw_category, normalized_category, source)
			 VALUES (?, ?, ?, ?, 'manual')
			 ON CONFLICT (household_id, raw_category)
			 DO UPDATE SET normalized_category = excluded.normalized_category,
			              source = 'manual'`
		)
		.bind(id, householdId, rawCategory, normalizedCategory)
		.run();

	// Apply to all existing expenses with this raw_category that have no override
	await db
		.prepare(
			`UPDATE expenses
			 SET normalized_category = ?, updated_at = datetime('now')
			 WHERE household_id = ? AND raw_category = ?
			   AND id NOT IN (
			     SELECT expense_id FROM category_overrides WHERE field = 'category'
			   )`
		)
		.bind(normalizedCategory, householdId, rawCategory)
		.run();

	return json({ ok: true });
};

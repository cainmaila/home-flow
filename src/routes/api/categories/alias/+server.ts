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
			`SELECT ca.id, ca.raw_category, ca.normalized_category, ca.category_id, ca.source, ca.created_at,
			        c.name as category_name, p.name as parent_name
			 FROM category_aliases ca
			 LEFT JOIN categories c ON ca.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE ca.household_id = ?
			 ORDER BY ca.created_at DESC`
		)
		.bind(householdId)
		.all<{
			id: string;
			raw_category: string;
			normalized_category: string;
			category_id: number | null;
			source: string;
			created_at: string;
			category_name: string | null;
			parent_name: string | null;
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
		categoryId?: number;
	};

	const householdId = body.householdId;
	const rawCategory = body.rawCategory;
	const categoryId = body.categoryId;

	if (!householdId) throw error(400, 'Missing householdId');
	if (!rawCategory) throw error(400, 'Missing rawCategory');
	if (!categoryId) throw error(400, 'Missing categoryId');

	// Look up category name for backward compat
	const cat = await db
		.prepare('SELECT name FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
		.bind(categoryId, householdId)
		.first<{ name: string }>();
	if (!cat) throw error(400, 'Category not found');

	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO category_aliases (id, household_id, raw_category, normalized_category, category_id, source)
			 VALUES (?, ?, ?, ?, ?, 'manual')
			 ON CONFLICT (household_id, raw_category)
			 DO UPDATE SET normalized_category = excluded.normalized_category,
			              category_id = excluded.category_id,
			              source = 'manual'`
		)
		.bind(id, householdId, rawCategory, cat.name, categoryId)
		.run();

	await db
		.prepare(
			`UPDATE expenses
			 SET category_id = ?, updated_at = datetime('now')
			 WHERE household_id = ? AND raw_category = ?
			   AND id NOT IN (
			     SELECT expense_id FROM category_overrides WHERE field = 'category'
			   )`
		)
		.bind(categoryId, householdId, rawCategory)
		.run();

	return json({ ok: true });
};

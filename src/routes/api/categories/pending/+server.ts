import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

/** GET: returns distinct raw_categories that have no normalized_category (unresolved). */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const householdId = url.searchParams.get('householdId') ?? 'default';

	const rows = await db
		.prepare(
			`SELECT DISTINCT raw_category, COUNT(*) as count
			 FROM expenses
			 WHERE household_id = ? AND normalized_category IS NULL
			 GROUP BY raw_category
			 ORDER BY count DESC`
		)
		.bind(householdId)
		.all<{ raw_category: string; count: number }>();

	return json(rows.results);
};

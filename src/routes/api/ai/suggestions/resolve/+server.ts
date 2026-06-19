/**
 * POST /api/ai/suggestions/resolve — Accept or reject a pending AI suggestion.
 * T5.4: Accepting writes to category_aliases with source='ai_auto' and updates expenses.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		suggestionId?: string;
		action?: 'accept' | 'reject';
	};

	if (!body.suggestionId) throw error(400, 'Missing suggestionId');
	if (body.action !== 'accept' && body.action !== 'reject') {
		throw error(400, 'action must be "accept" or "reject"');
	}

	const suggestion = await db
		.prepare(`SELECT * FROM ai_suggestions WHERE id = ? AND status = 'pending'`)
		.bind(body.suggestionId)
		.first<{
			id: string;
			household_id: string;
			raw_category: string;
			suggested_category: string;
		}>();

	if (!suggestion) throw error(404, 'Pending suggestion not found');

	if (body.action === 'accept') {
		// Write alias mapping
		await db
			.prepare(
				`INSERT INTO category_aliases (id, household_id, raw_category, normalized_category, source)
				 VALUES (?, ?, ?, ?, 'ai_auto')
				 ON CONFLICT (household_id, raw_category) DO UPDATE SET normalized_category = excluded.normalized_category, source = 'ai_auto'`
			)
			.bind(
				crypto.randomUUID(),
				suggestion.household_id,
				suggestion.raw_category,
				suggestion.suggested_category
			)
			.run();

		// Update expenses that match this raw_category and have no normalized_category
		await db
			.prepare(
				`UPDATE expenses SET normalized_category = ?, updated_at = datetime('now')
				 WHERE household_id = ? AND raw_category = ? AND normalized_category IS NULL`
			)
			.bind(suggestion.suggested_category, suggestion.household_id, suggestion.raw_category)
			.run();
	}

	// Mark suggestion as accepted/rejected
	await db
		.prepare(
			`UPDATE ai_suggestions SET status = ?, resolved_at = datetime('now') WHERE id = ?`
		)
		.bind(body.action === 'accept' ? 'accepted' : 'rejected', body.suggestionId)
		.run();

	return json({ ok: true });
};

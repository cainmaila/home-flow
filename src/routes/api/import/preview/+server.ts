import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { normalizeRecords } from '$lib/server/csv/normalize';
import { buildPreview } from '$lib/server/import/preview';
import type { ParsedRecord } from '$lib/server/csv/parser';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const user = requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		records?: ParsedRecord[];
		householdId?: string;
		filename?: string;
	};
	const records = body.records;
	const householdId = body.householdId;
	const filename = body.filename ?? 'unknown.csv';

	if (!records || records.length === 0) {
		throw error(400, 'No records provided');
	}
	if (!householdId) {
		throw error(400, 'Missing householdId');
	}

	const normalized = normalizeRecords(records, householdId);
	const result = await buildPreview(db, normalized, householdId, user.email, filename);

	return json(result);
};

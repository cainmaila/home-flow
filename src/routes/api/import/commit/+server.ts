import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { commitImport } from '$lib/server/import/commit';
import type { PreviewRecord } from '$lib/server/import/preview';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		importId?: string;
		householdId?: string;
		records?: PreviewRecord[];
	};
	const importId = body.importId;
	const householdId = body.householdId;
	const records = body.records;

	if (!importId) throw error(400, 'Missing importId');
	if (!householdId) throw error(400, 'Missing householdId');
	if (!records || records.length === 0) {
		throw error(400, 'No records provided');
	}

	// Verify import exists and is in previewed state
	const importJob = await db
		.prepare(`SELECT status FROM imports WHERE id = ? AND household_id = ?`)
		.bind(importId, householdId)
		.first<{ status: string }>();

	if (!importJob) throw error(404, 'Import not found');
	if (importJob.status !== 'previewed') {
		throw error(400, `Import status is '${importJob.status}', expected 'previewed'`);
	}

	const result = await commitImport(db, importId, householdId, records);
	return json(result);
};

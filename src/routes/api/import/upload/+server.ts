import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/guard';
import { parseAndValidateAI } from '$lib/server/csv/validator';
import { isAIEnabled } from '$lib/server/ai/config';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);

	const formData = await request.formData();
	const file = formData.get('file');

	if (!file || !(file instanceof File)) {
		throw error(400, 'No file uploaded');
	}

	if (file.size > MAX_SIZE) {
		throw error(400, 'File exceeds 10MB limit');
	}

	const yearStr = formData.get('year');
	const year = yearStr ? parseInt(String(yearStr), 10) : new Date().getFullYear();
	if (!Number.isFinite(year) || year < 2000 || year > 2100) {
		throw error(400, 'Invalid year');
	}

	const text = await file.text();

	const env = platform?.env;
	const apiKey = env && isAIEnabled(env) ? env.GOOGLE_AI_API_KEY : undefined;

	const result = await parseAndValidateAI(text, year, apiKey);

	const hasBlocking = result.errors.some((e) => e.severity === 'blocking');

	return json({
		ok: !hasBlocking,
		recordCount: result.records.length,
		records: result.records,
		errors: result.errors,
		format: result.format
	});
};

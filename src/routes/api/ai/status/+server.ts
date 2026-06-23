/**
 * GET /api/ai/status — Returns AI feature status.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';
import { isAIEnabled } from '$lib/server/ai/config';
import { isAutoDisabledByFailures } from '$lib/server/ai/gemini';

export const GET: RequestHandler = async ({ locals, platform }) => {
	requireAuth(locals);

	const env = platform?.env;
	if (!env) throw error(500, 'Platform not available');

	return json({
		enabled: isAIEnabled(env),
		autoDisabledByFailures: isAutoDisabledByFailures()
	});
};

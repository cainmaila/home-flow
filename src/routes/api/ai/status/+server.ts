/**
 * GET /api/ai/status — Returns AI feature status and quota info.
 * T5.5: Exposes feature flag state, quota usage, and failure state.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';
import { isAIEnabled } from '$lib/server/ai/config';
import { isAutoDisabledByFailures } from '$lib/server/ai/gemini';
import { getQuotaStatus, isAutoSuggestDisabled } from '$lib/server/ai/quota';

export const GET: RequestHandler = async ({ locals, platform }) => {
	requireAuth(locals);

	const env = platform?.env;
	if (!env) throw error(500, 'Platform not available');

	const quota = getQuotaStatus();

	return json({
		enabled: isAIEnabled(env),
		autoDisabledByFailures: isAutoDisabledByFailures(),
		autoSuggestDisabledByQuota: isAutoSuggestDisabled(),
		quota
	});
};

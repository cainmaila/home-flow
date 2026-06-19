/**
 * AI feature configuration helpers.
 * T5.2: Feature flag — when disabled, all AI features are no-ops.
 */

type Env = App.Platform['env'];

export function isAIEnabled(env: Env): boolean {
	return env.AI_FEATURE_ENABLED === 'true' && !!env.GOOGLE_AI_API_KEY;
}

export function getAutoAcceptThreshold(env: Env): number {
	return Number(env.AI_AUTO_ACCEPT_THRESHOLD) || 0.85;
}

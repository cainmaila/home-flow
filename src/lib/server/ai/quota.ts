/**
 * Simple in-memory quota tracker for AI API calls.
 * T5.5: Track usage, warn at 80%, disable auto-suggestions at 90%.
 * Resets monthly (approximate: resets when month changes).
 */

const DEFAULT_MONTHLY_LIMIT = 100;

interface QuotaState {
	count: number;
	month: string; // 'YYYY-MM'
	limit: number;
}

const state: QuotaState = {
	count: 0,
	month: getCurrentMonth(),
	limit: DEFAULT_MONTHLY_LIMIT
};

function getCurrentMonth(): string {
	return new Date().toISOString().slice(0, 7);
}

function ensureCurrentMonth(): void {
	const now = getCurrentMonth();
	if (state.month !== now) {
		state.count = 0;
		state.month = now;
	}
}

export function recordCall(): void {
	ensureCurrentMonth();
	state.count++;
	const pct = state.count / state.limit;
	if (pct >= 0.8 && pct < 0.9) {
		console.warn(`[AI quota] Warning: ${state.count}/${state.limit} calls used (${Math.round(pct * 100)}%)`);
	} else if (pct >= 0.9) {
		console.warn(`[AI quota] Critical: ${state.count}/${state.limit} calls used — auto-suggestions disabled`);
	}
}

export function isQuotaExceeded(): boolean {
	ensureCurrentMonth();
	return state.count >= state.limit;
}

/** At 90%+, auto-suggestions should be disabled (manual-only). */
export function isAutoSuggestDisabled(): boolean {
	ensureCurrentMonth();
	return state.count / state.limit >= 0.9;
}

export function getQuotaStatus(): { count: number; limit: number; month: string; percentage: number } {
	ensureCurrentMonth();
	return {
		count: state.count,
		limit: state.limit,
		month: state.month,
		percentage: Math.round((state.count / state.limit) * 100)
	};
}

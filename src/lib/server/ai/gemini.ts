/**
 * Server-side Gemini API caller for category suggestions.
 * T5.1: Proxy to Gemini 2.5 Flash-Lite. Key stays server-side.
 * T5.3: Rate limiting, error handling, fallback, auto-disable.
 */

import { recordCall } from './quota';

export interface CategorySuggestion {
	raw_category: string;
	suggested_category: string;
	confidence: number;
}

const GEMINI_URL =
	'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;

let consecutiveFailures = 0;
let autoDisabled = false;

export function isAutoDisabledByFailures(): boolean {
	return autoDisabled;
}

export function resetAutoDisable(): void {
	consecutiveFailures = 0;
	autoDisabled = false;
}

function buildPrompt(unmatchedCategories: string[], existingCategories: string[]): string {
	return `You are a household expense category matcher.

Given these unmatched category names from a CSV import:
${JSON.stringify(unmatchedCategories)}

And these existing standard categories:
${JSON.stringify(existingCategories)}

For each unmatched category, suggest the best matching standard category and a confidence score (0 to 1).
If no good match exists, use the closest category with a low confidence.

Respond ONLY with a JSON array, no markdown, no explanation:
[{"raw_category":"...","suggested_category":"...","confidence":0.XX}]`;
}

export async function suggestCategories(
	unmatchedCategories: string[],
	existingCategories: string[],
	apiKey: string
): Promise<CategorySuggestion[]> {
	if (autoDisabled) {
		console.warn('[AI] Auto-disabled due to consecutive failures. Call resetAutoDisable() to re-enable.');
		return [];
	}

	if (unmatchedCategories.length === 0) return [];

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const prompt = buildPrompt(unmatchedCategories, existingCategories);
		const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
			signal: controller.signal
		});

		if (!res.ok) {
			throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
		}

		const data = (await res.json()) as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		};

		const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) throw new Error('Empty response from Gemini');

		// Extract JSON array from response (may have markdown code fences)
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) throw new Error('No JSON array in Gemini response');

		const suggestions = JSON.parse(jsonMatch[0]) as CategorySuggestion[];

		// Validate structure
		const valid = suggestions.filter(
			(s) =>
				typeof s.raw_category === 'string' &&
				typeof s.suggested_category === 'string' &&
				typeof s.confidence === 'number' &&
				s.confidence >= 0 &&
				s.confidence <= 1
		);

		// Success: reset failure counter
		consecutiveFailures = 0;
		recordCall();

		return valid;
	} catch (err) {
		consecutiveFailures++;
		console.error(`[AI] Gemini call failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, err);

		if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
			autoDisabled = true;
			console.error('[AI] Auto-disabled after consecutive failures.');
		}

		return [];
	} finally {
		clearTimeout(timeout);
	}
}

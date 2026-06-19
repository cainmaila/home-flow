import { recordCall } from './quota';

export interface CategorySuggestion {
	raw_category: string;
	suggested_category: string;
	confidence: number;
}

export interface CategoryWithExamples {
	name: string;
	parent_name: string;
	description: string | null;
	examples: string[];
}

const GEMINI_URL =
	'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_PROMPT_CHARS = 12_000; // ~4000 tokens

let consecutiveFailures = 0;
let autoDisabled = false;

export function isAutoDisabledByFailures(): boolean {
	return autoDisabled;
}

function buildPrompt(
	unmatchedCategories: string[],
	categoriesWithExamples: CategoryWithExamples[]
): string {
	const categoryLines = categoriesWithExamples.map((c) => {
		const label = `${c.parent_name}（${c.description ?? ''}）> ${c.name}`;
		if (c.examples.length > 0) {
			return `- ${label}  歷史：${c.examples.join('、')}`;
		}
		return `- ${label}  （無歷史範例）`;
	});

	let categoryBlock = categoryLines.join('\n');

	// Truncate if too long — drop examples from end
	if (categoryBlock.length > MAX_PROMPT_CHARS) {
		const shortLines = categoriesWithExamples.map((c) => `- ${c.parent_name} > ${c.name}`);
		categoryBlock = shortLines.join('\n');
	}

	return `You are a household expense category matcher.

Given these unmatched category names from a CSV import:
${JSON.stringify(unmatchedCategories)}

Available categories (format: parent > child):
${categoryBlock}

For each unmatched category, suggest the best matching child category name (just the child name, not "parent > child") and a confidence score (0 to 1).
If no good match exists, use the closest category with a low confidence.

Respond ONLY with a JSON array, no markdown, no explanation:
[{"raw_category":"...","suggested_category":"...","confidence":0.XX}]`;
}

/**
 * Load categories with historical examples from DB.
 * Each child category gets up to 10 most recent raw_category values from aliases.
 */
export async function loadCategoriesWithExamples(
	db: D1Database,
	householdId: string
): Promise<CategoryWithExamples[]> {
	const cats = await db
		.prepare(
			`SELECT c.id, c.name, p.name as parent_name, p.description
			 FROM categories c
			 JOIN categories p ON c.parent_id = p.id
			 WHERE c.household_id = ? AND c.is_deleted = 0 AND c.parent_id IS NOT NULL
			 ORDER BY p.sort_order, c.sort_order`
		)
		.bind(householdId)
		.all<{ id: number; name: string; parent_name: string; description: string | null }>();

	const result: CategoryWithExamples[] = [];

	for (const cat of cats.results) {
		const aliases = await db
			.prepare(
				`SELECT raw_category FROM category_aliases
				 WHERE household_id = ? AND category_id = ?
				 ORDER BY created_at DESC LIMIT 10`
			)
			.bind(householdId, cat.id)
			.all<{ raw_category: string }>();

		result.push({
			name: cat.name,
			parent_name: cat.parent_name,
			description: cat.description,
			examples: aliases.results.map((a) => a.raw_category)
		});
	}

	return result;
}

export async function suggestCategories(
	unmatchedCategories: string[],
	apiKey: string,
	categoriesWithExamples: CategoryWithExamples[]
): Promise<CategorySuggestion[]> {
	if (autoDisabled) {
		console.warn('[AI] Auto-disabled due to consecutive failures.');
		return [];
	}

	if (unmatchedCategories.length === 0) return [];

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const cats = categoriesWithExamples;

		const prompt = buildPrompt(unmatchedCategories, cats);
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

		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) throw new Error('No JSON array in Gemini response');

		const suggestions = JSON.parse(jsonMatch[0]) as CategorySuggestion[];

		const valid = suggestions.filter(
			(s) =>
				typeof s.raw_category === 'string' &&
				typeof s.suggested_category === 'string' &&
				typeof s.confidence === 'number' &&
				s.confidence >= 0 &&
				s.confidence <= 1
		);

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

/**
 * AI-driven CSV structure analysis.
 * Sends a sample of the CSV to Gemini to identify column mapping.
 */

const GEMINI_URL =
	'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const TIMEOUT_MS = 15_000;
const SAMPLE_ROWS = 25;

export interface CSVMapping {
	format: 'flat' | 'transposed';
	// flat format: which column index holds each field
	dateCol?: number;
	categoryCol?: number;
	amountCol?: number;
	headerRow?: number;
	// transposed format: use legacy parser
}

function getSample(csv: string): string {
	const lines = csv.split(/\r?\n/);
	return lines.slice(0, Math.min(lines.length, SAMPLE_ROWS)).join('\n');
}

export async function analyzeCSVStructure(csv: string, apiKey: string): Promise<CSVMapping> {
	const sample = getSample(csv);

	const prompt = `You are a CSV structure analyzer. Analyze this CSV sample and tell me:

1. Is this a "flat" format (one row per record, with column headers) or "transposed" format (categories as rows, dates as columns)?

2. If flat: which column INDEX (0-based) contains:
   - The expense date (M/D format like 5/23 or 6/1)
   - The expense category name (text like 早餐, 午餐, 加油)
   - The amount (number)
   - Which row index (0-based) is the header row

CSV sample:
${sample}

Respond ONLY with JSON, no markdown:
{"format":"flat","dateCol":1,"categoryCol":4,"amountCol":5,"headerRow":0}
or
{"format":"transposed"}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
			signal: controller.signal
		});

		if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

		const data = (await res.json()) as {
			candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
		};

		const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) throw new Error('Empty AI response');

		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error('No JSON in AI response');

		const mapping = JSON.parse(jsonMatch[0]) as CSVMapping;

		if (mapping.format === 'flat') {
			if (mapping.dateCol === undefined || mapping.categoryCol === undefined || mapping.amountCol === undefined) {
				throw new Error('AI returned incomplete flat mapping');
			}
			mapping.headerRow ??= 0;
		}

		return mapping;
	} finally {
		clearTimeout(timeout);
	}
}

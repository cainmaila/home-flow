import { describe, it, expect } from 'vitest';
import { resolveCategory } from './resolve';

/**
 * Tests for the 4-layer category resolution priority chain (Data-Rules §4.4).
 *
 * Since resolveCategory uses D1Database, we mock the DB with a minimal stub
 * that returns controlled results for each layer.
 */

type MockRow = Record<string, unknown> | null;

/** Create a mock D1Database that returns predefined results for sequential queries. */
function mockDB(queryResults: MockRow[]): D1Database {
	let callIndex = 0;
	return {
		prepare: () => ({
			bind: () => ({
				first: async () => {
					const result = queryResults[callIndex++] ?? null;
					return result;
				},
				all: async () => ({ results: [] }),
				run: async () => ({})
			})
		})
	} as unknown as D1Database;
}

describe('T3.3: category resolution 4-layer priority', () => {
	it('layer 1: override wins over everything', async () => {
		// Query order: override lookup, alias lookup, (fallback is code-only)
		// Override returns a result -> should stop there
		const db = mockDB([{ new_value: '外出' }]);
		const result = await resolveCategory(db, 'hh-1', '午餐', 'exp-1');

		expect(result.normalized_category).toBe('外出');
		expect(result.source).toBe('override');
	});

	it('layer 2: manual alias wins over ai_auto when no override', async () => {
		// Override returns null, alias returns manual
		const db = mockDB([null, { normalized_category: '飲料', source: 'manual' }]);
		const result = await resolveCategory(db, 'hh-1', '手搖飲', 'exp-1');

		expect(result.normalized_category).toBe('飲料');
		expect(result.source).toBe('manual');
	});

	it('layer 3: ai_auto alias used when no override and no manual alias', async () => {
		// Override returns null, alias returns ai_auto
		const db = mockDB([null, { normalized_category: '零食', source: 'ai_auto' }]);
		const result = await resolveCategory(db, 'hh-1', '消夜/零食', 'exp-1');

		expect(result.normalized_category).toBe('零食');
		expect(result.source).toBe('ai_auto');
	});

	it('layer 4: fallback exact match with standard category', async () => {
		// Override returns null, alias returns null, raw_category is a standard category
		const db = mockDB([null, null]);
		const result = await resolveCategory(db, 'hh-1', '午餐', 'exp-1');

		expect(result.normalized_category).toBe('午餐');
		expect(result.source).toBe('fallback');
	});

	it('returns null when no layer matches', async () => {
		// Override returns null, alias returns null, raw_category is NOT a standard category
		const db = mockDB([null, null]);
		const result = await resolveCategory(db, 'hh-1', '消夜/零食', 'exp-1');

		expect(result.normalized_category).toBeNull();
		expect(result.source).toBeNull();
	});

	it('skips override layer when no expenseId provided', async () => {
		// No expenseId -> alias lookup is the first query
		const db = mockDB([{ normalized_category: '交通', source: 'manual' }]);
		const result = await resolveCategory(db, 'hh-1', '交-加油');

		expect(result.normalized_category).toBe('交通');
		expect(result.source).toBe('manual');
	});

	it('skips override layer and falls back when no alias and standard match', async () => {
		// No expenseId -> alias lookup returns null -> fallback
		const db = mockDB([null]);
		const result = await resolveCategory(db, 'hh-1', '早餐');

		expect(result.normalized_category).toBe('早餐');
		expect(result.source).toBe('fallback');
	});

	it('skips override layer and returns null when nothing matches', async () => {
		const db = mockDB([null]);
		const result = await resolveCategory(db, 'hh-1', '未知分類');

		expect(result.normalized_category).toBeNull();
		expect(result.source).toBeNull();
	});
});

import { describe, it, expect } from 'vitest';
import { resolveCategory } from './resolve';

type MockRow = Record<string, unknown> | null;

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

describe('T3.3: category resolution 4-layer priority (category_id)', () => {
	it('layer 1: override wins over everything', async () => {
		const db = mockDB([{ category_id: 10 }]);
		const result = await resolveCategory(db, 'hh-1', '午餐', 'exp-1');
		expect(result.category_id).toBe(10);
		expect(result.source).toBe('override');
	});

	it('layer 2: manual alias wins over ai_auto when no override', async () => {
		const db = mockDB([null, { category_id: 13, source: 'manual' }]);
		const result = await resolveCategory(db, 'hh-1', '手搖飲', 'exp-1');
		expect(result.category_id).toBe(13);
		expect(result.source).toBe('manual');
	});

	it('layer 3: ai_auto alias used when no override and no manual alias', async () => {
		const db = mockDB([null, { category_id: 16, source: 'ai_auto' }]);
		const result = await resolveCategory(db, 'hh-1', '消夜/零食', 'exp-1');
		expect(result.category_id).toBe(16);
		expect(result.source).toBe('ai_auto');
	});

	it('layer 4: fallback exact match from categories table', async () => {
		const db = mockDB([null, null, { id: 11 }]);
		const result = await resolveCategory(db, 'hh-1', '午餐', 'exp-1');
		expect(result.category_id).toBe(11);
		expect(result.source).toBe('fallback');
	});

	it('returns null when no layer matches', async () => {
		const db = mockDB([null, null, null]);
		const result = await resolveCategory(db, 'hh-1', '消夜/零食', 'exp-1');
		expect(result.category_id).toBeNull();
		expect(result.source).toBeNull();
	});

	it('skips override layer when no expenseId provided', async () => {
		const db = mockDB([{ category_id: 22, source: 'manual' }]);
		const result = await resolveCategory(db, 'hh-1', '交-加油');
		expect(result.category_id).toBe(22);
		expect(result.source).toBe('manual');
	});

	it('skips override layer and falls back when no alias', async () => {
		const db = mockDB([null, { id: 10 }]);
		const result = await resolveCategory(db, 'hh-1', '早餐');
		expect(result.category_id).toBe(10);
		expect(result.source).toBe('fallback');
	});

	it('skips override layer and returns null when nothing matches', async () => {
		const db = mockDB([null, null]);
		const result = await resolveCategory(db, 'hh-1', '未知分類');
		expect(result.category_id).toBeNull();
		expect(result.source).toBeNull();
	});
});

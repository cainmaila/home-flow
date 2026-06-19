import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, requireAuth } from '$lib/server/auth/guard';

interface CategoryRow {
	id: number;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	parent_id: number | null;
	sort_order: number;
	is_deleted: number;
}

interface CategoryTree {
	id: number;
	name: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	sort_order: number;
	children: Omit<CategoryTree, 'children' | 'description'>[];
}

function buildTree(rows: CategoryRow[]): CategoryTree[] {
	const parents = rows.filter((r) => r.parent_id === null);
	const childrenByParent = new Map<number, CategoryRow[]>();
	for (const r of rows) {
		if (r.parent_id !== null) {
			const list = childrenByParent.get(r.parent_id) ?? [];
			list.push(r);
			childrenByParent.set(r.parent_id, list);
		}
	}
	return parents.map((p) => ({
		id: p.id,
		name: p.name,
		description: p.description,
		icon: p.icon,
		color: p.color,
		sort_order: p.sort_order,
		children: (childrenByParent.get(p.id) ?? []).map((c) => ({
			id: c.id,
			name: c.name,
			icon: c.icon,
			color: c.color,
			sort_order: c.sort_order
		}))
	}));
}

/** GET: return two-level category tree. */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	requireAuth(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');
	const householdId = url.searchParams.get('householdId') ?? 'default';

	const rows = await db
		.prepare(
			`SELECT id, name, description, icon, color, parent_id, sort_order, is_deleted
			 FROM categories
			 WHERE household_id = ? AND is_deleted = 0
			 ORDER BY sort_order`
		)
		.bind(householdId)
		.all<CategoryRow>();

	return json(buildTree(rows.results));
};

/** POST: create a category (parent or child). */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		householdId?: string;
		name?: string;
		description?: string;
		icon?: string;
		color?: string;
		parentId?: number;
	};

	const householdId = body.householdId ?? 'default';
	if (!body.name?.trim()) throw error(400, 'Missing name');

	if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
		throw error(400, 'Invalid color format');
	}

	if (body.parentId !== undefined) {
		const parent = await db
			.prepare('SELECT id, parent_id FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
			.bind(body.parentId, householdId)
			.first<{ id: number; parent_id: number | null }>();
		if (!parent) throw error(400, 'Parent category not found');
		if (parent.parent_id !== null) throw error(400, 'Cannot nest beyond two levels');
	}

	const maxOrder = await db
		.prepare(
			body.parentId !== undefined
				? 'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM categories WHERE household_id = ? AND parent_id = ? AND is_deleted = 0'
				: 'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM categories WHERE household_id = ? AND parent_id IS NULL AND is_deleted = 0'
		)
		.bind(...(body.parentId !== undefined ? [householdId, body.parentId] : [householdId]))
		.first<{ max_order: number }>();

	const sortOrder = (maxOrder?.max_order ?? 0) + 1;

	const result = await db
		.prepare(
			`INSERT INTO categories (household_id, name, description, icon, color, parent_id, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			householdId,
			body.name.trim(),
			body.description?.trim() ?? null,
			body.icon?.trim() ?? null,
			body.color ?? null,
			body.parentId ?? null,
			sortOrder
		)
		.run();

	return json({ ok: true, id: result.meta.last_row_id });
};

/** PUT: update a category (name, icon, color, description, sort_order). */
export const PUT: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		id?: number;
		householdId?: string;
		name?: string;
		description?: string;
		icon?: string;
		color?: string;
		sortOrder?: number;
	};

	if (!body.id) throw error(400, 'Missing id');
	const householdId = body.householdId ?? 'default';

	if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
		throw error(400, 'Invalid color format');
	}

	const existing = await db
		.prepare('SELECT id FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
		.bind(body.id, householdId)
		.first();
	if (!existing) throw error(404, 'Category not found');

	const sets: string[] = [];
	const vals: unknown[] = [];

	if (body.name !== undefined) {
		sets.push('name = ?');
		vals.push(body.name.trim());
	}
	if (body.description !== undefined) {
		sets.push('description = ?');
		vals.push(body.description.trim() || null);
	}
	if (body.icon !== undefined) {
		sets.push('icon = ?');
		vals.push(body.icon.trim() || null);
	}
	if (body.color !== undefined) {
		sets.push('color = ?');
		vals.push(body.color || null);
	}
	if (body.sortOrder !== undefined) {
		sets.push('sort_order = ?');
		vals.push(body.sortOrder);
	}

	if (sets.length === 0) throw error(400, 'Nothing to update');

	sets.push("updated_at = datetime('now')");
	vals.push(body.id, householdId);

	await db
		.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND household_id = ?`)
		.bind(...vals)
		.run();

	return json({ ok: true });
};

/** DELETE: soft-delete a category. If parent, cascade to children. */
export const DELETE: RequestHandler = async ({ request, locals, platform }) => {
	requireAdmin(locals);
	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const body = (await request.json()) as {
		id?: number;
		householdId?: string;
	};

	if (!body.id) throw error(400, 'Missing id');
	const householdId = body.householdId ?? 'default';

	const cat = await db
		.prepare('SELECT id, parent_id FROM categories WHERE id = ? AND household_id = ? AND is_deleted = 0')
		.bind(body.id, householdId)
		.first<{ id: number; parent_id: number | null }>();
	if (!cat) throw error(404, 'Category not found');

	const idsToDelete: number[] = [body.id];

	// If parent, cascade to children
	if (cat.parent_id === null) {
		const children = await db
			.prepare('SELECT id FROM categories WHERE parent_id = ? AND household_id = ? AND is_deleted = 0')
			.bind(body.id, householdId)
			.all<{ id: number }>();
		idsToDelete.push(...children.results.map((c) => c.id));
	}

	const placeholders = idsToDelete.map(() => '?').join(',');

	// Soft-delete categories
	await db
		.prepare(
			`UPDATE categories SET is_deleted = 1, updated_at = datetime('now')
			 WHERE id IN (${placeholders}) AND household_id = ?`
		)
		.bind(...idsToDelete, householdId)
		.run();

	// Count affected expenses
	const affected = await db
		.prepare(
			`SELECT COUNT(*) as count FROM expenses
			 WHERE household_id = ? AND category_id IN (${placeholders})`
		)
		.bind(householdId, ...idsToDelete)
		.first<{ count: number }>();

	// Null out category_id on affected expenses (mark as "未分類")
	await db
		.prepare(
			`UPDATE expenses SET category_id = NULL, updated_at = datetime('now')
			 WHERE household_id = ? AND category_id IN (${placeholders})`
		)
		.bind(householdId, ...idsToDelete)
		.run();

	// Soft-delete related aliases
	await db
		.prepare(
			`DELETE FROM category_aliases
			 WHERE household_id = ? AND category_id IN (${placeholders})`
		)
		.bind(householdId, ...idsToDelete)
		.run();

	// Auto-reject pending AI suggestions targeting deleted categories
	await db
		.prepare(
			`UPDATE ai_suggestions SET status = 'rejected', resolved_at = datetime('now')
			 WHERE household_id = ? AND status = 'pending' AND suggested_category_id IN (${placeholders})`
		)
		.bind(householdId, ...idsToDelete)
		.run();

	return json({
		ok: true,
		deleted_categories: idsToDelete.length,
		affected_expenses: affected?.count ?? 0
	});
};

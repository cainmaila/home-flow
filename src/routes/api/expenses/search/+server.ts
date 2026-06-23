import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth/guard';

const HOUSEHOLD_ID = 'default';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
	requireAuth(locals);

	const db = platform?.env?.DB;
	if (!db) throw error(500, 'Database not available');

	const month = url.searchParams.get('month');
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const category = url.searchParams.get('category');
	const categoryId = url.searchParams.get('categoryId');
	const fixed = url.searchParams.get('fixed');
	const tagsParam = url.searchParams.get('tags');

	const conditions: string[] = ['e.household_id = ?'];
	const binds: (string | number)[] = [HOUSEHOLD_ID];

	if (month) {
		conditions.push("strftime('%Y-%m', e.expense_date) = ?");
		binds.push(month);
	}
	if (dateFrom) {
		conditions.push('e.expense_date >= ?');
		binds.push(dateFrom);
	}
	if (dateTo) {
		conditions.push('e.expense_date <= ?');
		binds.push(dateTo);
	}
	if (categoryId) {
		conditions.push('e.category_id = ?');
		binds.push(Number(categoryId));
	} else if (category) {
		conditions.push('COALESCE(c.name, e.raw_category) = ?');
		binds.push(category);
	}
	if (fixed === 'true') {
		conditions.push(
			`EXISTS (SELECT 1 FROM expense_tags et2 JOIN tags t2 ON et2.tag_id = t2.id WHERE et2.expense_id = e.id AND t2.name = '固定')`
		);
	} else if (fixed === 'false') {
		conditions.push(
			`NOT EXISTS (SELECT 1 FROM expense_tags et2 JOIN tags t2 ON et2.tag_id = t2.id WHERE et2.expense_id = e.id AND t2.name = '固定')`
		);
	}
	if (tagsParam) {
		const tagNames = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
		if (tagNames.length > 0) {
			const ph = tagNames.map(() => '?').join(',');
			conditions.push(
				`EXISTS (SELECT 1 FROM expense_tags et2 JOIN tags t2 ON et2.tag_id = t2.id WHERE et2.expense_id = e.id AND t2.name IN (${ph}))`
			);
			binds.push(...tagNames);
		}
	}

	const where = conditions.join(' AND ');

	const countResult = await db
		.prepare(
			`SELECT COUNT(*) as count, SUM(e.amount) as total
			 FROM expenses e
			 LEFT JOIN categories c ON e.category_id = c.id
			 WHERE ${where}`
		)
		.bind(...binds)
		.first<{ count: number; total: number | null }>();

	const rows = await db
		.prepare(
			`SELECT e.id, e.expense_date, e.raw_category, e.category_id, e.amount,
			        e.detail, e.payment_method,
			        COALESCE(c.name, e.raw_category) as category_name,
			        p.name as parent_category_name,
			        (SELECT GROUP_CONCAT(t.name) FROM expense_tags et JOIN tags t ON et.tag_id = t.id WHERE et.expense_id = e.id) as tag_names
			 FROM expenses e
			 LEFT JOIN categories c ON e.category_id = c.id
			 LEFT JOIN categories p ON c.parent_id = p.id
			 WHERE ${where}
			 ORDER BY e.expense_date DESC, e.raw_category ASC`
		)
		.bind(...binds)
		.all<{
			id: string;
			expense_date: string;
			raw_category: string;
			category_id: number | null;
			amount: number;
			detail: string | null;
			payment_method: string;
			category_name: string;
			parent_category_name: string | null;
			tag_names: string | null;
		}>();

	const expenses = rows.results.map((r) => ({
		id: r.id,
		expense_date: r.expense_date,
		raw_category: r.raw_category,
		category_id: r.category_id,
		category_name: r.category_name,
		parent_category_name: r.parent_category_name,
		normalized_category: r.category_name,
		amount: r.amount,
		detail: r.detail,
		payment_method: r.payment_method,
		tags: r.tag_names ? r.tag_names.split(',') : []
	}));

	return json({
		expenses,
		total: countResult?.total ?? 0,
		count: countResult?.count ?? 0
	});
};

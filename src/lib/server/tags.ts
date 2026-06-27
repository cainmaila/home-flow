const MAX_TAG_LENGTH = 20;
const MAX_TAGS_PER_EXPENSE = 10;

export function cleanTagNames(names: string[]): string[] {
	return [
		...new Set(names.map((t) => t.trim().slice(0, MAX_TAG_LENGTH)).filter((t) => t.length > 0))
	].slice(0, MAX_TAGS_PER_EXPENSE);
}

export async function setExpenseTags(
	db: D1Database,
	householdId: string,
	expenseId: string,
	tagNames: string[]
): Promise<void> {
	const cleaned = cleanTagNames(tagNames);

	await db.prepare('DELETE FROM expense_tags WHERE expense_id = ?').bind(expenseId).run();

	if (cleaned.length === 0) return;

	const stmts: D1PreparedStatement[] = [];

	for (const name of cleaned) {
		stmts.push(
			db.prepare('INSERT OR IGNORE INTO tags (household_id, name) VALUES (?, ?)').bind(householdId, name)
		);
	}

	const placeholders = cleaned.map(() => '?').join(',');
	stmts.push(
		db
			.prepare(
				`INSERT INTO expense_tags (expense_id, tag_id)
				 SELECT ?, id FROM tags WHERE household_id = ? AND name IN (${placeholders})`
			)
			.bind(expenseId, householdId, ...cleaned)
	);

	await db.batch(stmts);
}

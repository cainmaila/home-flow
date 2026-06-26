import type { D1Database } from '@cloudflare/workers-types';

export interface Installment {
	id: string;
	household_id: string;
	total_amount: number;
	periods: number;
	start_month: string;
	category_id: number | null;
	detail: string | null;
	payment_method: string;
}

function splitAmount(total: number, periods: number): number[] {
	const per = Math.floor(total / periods);
	const amounts = Array(periods).fill(per) as number[];
	amounts[periods - 1] = total - per * (periods - 1);
	const sum = amounts.reduce((a, b) => a + b, 0);
	if (sum !== total) throw new Error(`splitAmount: sum ${sum} !== total ${total}`);
	return amounts;
}

function addMonths(startMonth: string, i: number): string {
	const [y, m] = startMonth.split('-').map(Number);
	const d = new Date(y, m - 1 + i, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function rebuildInstallmentExpenses(
	db: D1Database,
	householdId: string,
	inst: Installment
): Promise<void> {
	const amounts = splitAmount(inst.total_amount, inst.periods);
	const insertSql = `INSERT INTO expenses (id, household_id, expense_date, raw_category, category_id, amount, detail, payment_method, installment_id)
		VALUES (?, ?, ?, '分期付款', ?, ?, ?, ?, ?)`;
	const stmts = [
		db
			.prepare(
				'DELETE FROM expense_tags WHERE expense_id IN (SELECT id FROM expenses WHERE installment_id = ?)'
			)
			.bind(inst.id),
		db.prepare('DELETE FROM expenses WHERE installment_id = ?').bind(inst.id)
	];
	for (let i = 0; i < amounts.length; i++) {
		stmts.push(
			db
				.prepare(insertSql)
				.bind(
					crypto.randomUUID(),
					householdId,
					addMonths(inst.start_month, i),
					inst.category_id ?? null,
					amounts[i],
					inst.detail,
					inst.payment_method,
					inst.id
				)
		);
	}
	await db.batch(stmts);
}

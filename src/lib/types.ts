export interface CategoryChild {
	id: number;
	name: string;
	icon?: string | null;
	color?: string | null;
	sort_order?: number;
}

export interface CategoryParent {
	id: number;
	name: string;
	description?: string | null;
	icon?: string | null;
	color?: string | null;
	sort_order?: number;
	children: CategoryChild[];
}

export interface Expense {
	id: string;
	expense_date: string;
	raw_category: string;
	normalized_category: string;
	category_id?: number | null;
	category_name?: string;
	parent_category_name?: string | null;
	amount: number;
	detail?: string | null;
	tags?: string[];
}

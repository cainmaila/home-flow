<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// --- Filter state ---
	let filterMonth = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let filterCategory = $state('');
	let filterFixed = $state(''); // '' | 'true' | 'false'

	let loading = $state(true);
	let errorMessage = $state('');

	let availableMonths: string[] = $state([]);
	let availableCategories: string[] = $state([]);

	interface Expense {
		id: string;
		expense_date: string;
		raw_category: string;
		normalized_category: string;
		category_id?: number | null;
		category_name?: string;
		parent_category_name?: string | null;
		amount: number;
		is_fixed_expense: boolean;
	}

	let expenses: Expense[] = $state([]);
	let total = $state(0);
	let count = $state(0);

	let sortField: 'expense_date' | 'normalized_category' | 'amount' = $state('expense_date');
	let sortAsc = $state(false);

	// --- Edit state ---
	let editingId = $state<string | null>(null);
	let editDate = $state('');
	let editAmount = $state('');
	let editCategoryId = $state<number | null>(null);
	let editFixed = $state(false);
	let saving = $state(false);

	// --- Categories for edit dropdown ---
	interface CategoryChild { id: number; name: string }
	interface CategoryGroup { id: number; name: string; children: CategoryChild[] }
	let categories: CategoryGroup[] = $state([]);

	// --- Delete confirm ---
	let deletingId = $state<string | null>(null);

	function formatAmount(cents: number): string {
		return Math.round(cents).toLocaleString('zh-TW');
	}

	async function loadMeta() {
		try {
			const res = await fetch('/api/reports/monthly');
			if (!res.ok) return;
			const data = (await res.json()) as {
				availableMonths?: string[];
				categoryBreakdown?: { category: string }[];
			};
			availableMonths = data.availableMonths ?? [];
			availableCategories = (data.categoryBreakdown ?? []).map((c) => c.category);
		} catch {
			// Non-blocking
		}
	}

	async function loadCategories() {
		try {
			const res = await fetch('/api/categories/manage');
			if (!res.ok) return;
			categories = await res.json();
		} catch {
			// Non-blocking
		}
	}

	async function search() {
		loading = true;
		errorMessage = '';

		const params = new URLSearchParams();
		if (filterMonth) params.set('month', filterMonth);
		if (filterDateFrom) params.set('dateFrom', filterDateFrom);
		if (filterDateTo) params.set('dateTo', filterDateTo);
		if (filterCategory) params.set('category', filterCategory);
		if (filterFixed) params.set('fixed', filterFixed);

		try {
			const res = await fetch(`/api/expenses/search?${params}`);
			if (!res.ok) {
				errorMessage = '查詢失敗';
				loading = false;
				return;
			}
			const data = (await res.json()) as {
				expenses: Expense[];
				total: number;
				count: number;
			};
			expenses = data.expenses;
			total = data.total;
			count = data.count;
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			loading = false;
		}
	}

	function handleSort(field: typeof sortField) {
		if (sortField === field) {
			sortAsc = !sortAsc;
		} else {
			sortField = field;
			sortAsc = true;
		}
	}

	let sortedExpenses = $derived.by(() => {
		const sorted = [...expenses];
		sorted.sort((a, b) => {
			let cmp = 0;
			if (sortField === 'expense_date') {
				cmp = a.expense_date.localeCompare(b.expense_date);
			} else if (sortField === 'normalized_category') {
				cmp = a.normalized_category.localeCompare(b.normalized_category);
			} else if (sortField === 'amount') {
				cmp = a.amount - b.amount;
			}
			return sortAsc ? cmp : -cmp;
		});
		return sorted;
	});

	function sortIndicator(field: typeof sortField): string {
		if (sortField !== field) return '';
		return sortAsc ? ' ▲' : ' ▼';
	}

	function clearFilters() {
		filterMonth = '';
		filterDateFrom = '';
		filterDateTo = '';
		filterCategory = '';
		filterFixed = '';
		search();
	}

	function startEdit(exp: Expense) {
		editingId = exp.id;
		editDate = exp.expense_date;
		editAmount = String(exp.amount);
		editCategoryId = exp.category_id ?? null;
		editFixed = exp.is_fixed_expense;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function saveEdit() {
		if (!editingId) return;
		saving = true;
		try {
			const res = await fetch(`/api/expenses/${editingId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					expense_date: editDate,
					amount: Number(editAmount),
					category_id: editCategoryId,
					is_fixed_expense: editFixed
				})
			});
			if (!res.ok) {
				const msg = await res.text();
				alert(`儲存失敗: ${msg}`);
				return;
			}
			editingId = null;
			await search();
		} finally {
			saving = false;
		}
	}

	async function confirmDelete(id: string) {
		deletingId = id;
	}

	async function doDelete() {
		if (!deletingId) return;
		saving = true;
		try {
			const res = await fetch(`/api/expenses/${deletingId}`, { method: 'DELETE' });
			if (!res.ok) {
				const msg = await res.text();
				alert(`刪除失敗: ${msg}`);
				return;
			}
			deletingId = null;
			await search();
		} finally {
			saving = false;
		}
	}

	onMount(async () => {
		const params = $page.url.searchParams;
		filterMonth = params.get('month') ?? '';
		filterCategory = params.get('category') ?? '';
		filterDateFrom = params.get('dateFrom') ?? '';
		filterDateTo = params.get('dateTo') ?? '';
		filterFixed = params.get('fixed') ?? '';

		await Promise.all([loadMeta(), loadCategories()]);
		await search();
	});
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">支出明細</h1>

	<!-- Filters -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<div class="flex flex-wrap gap-4 items-end">
				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">月份</span></div>
					<select class="select select-bordered select-sm" bind:value={filterMonth} onchange={() => search()}>
						<option value="">全部</option>
						{#each availableMonths as m}
							<option value={m}>{m}</option>
						{/each}
					</select>
				</label>

				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">分類</span></div>
					<select class="select select-bordered select-sm" bind:value={filterCategory} onchange={() => search()}>
						<option value="">全部</option>
						{#each availableCategories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</label>

				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">固定支出</span></div>
					<select class="select select-bordered select-sm" bind:value={filterFixed} onchange={() => search()}>
						<option value="">全部</option>
						<option value="true">固定</option>
						<option value="false">非固定</option>
					</select>
				</label>
			</div>

			<div class="flex flex-wrap gap-4 items-end mt-2">
				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">日期從</span></div>
					<input type="date" class="input input-bordered input-sm" bind:value={filterDateFrom} onchange={() => search()} />
				</label>
				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">日期到</span></div>
					<input type="date" class="input input-bordered input-sm" bind:value={filterDateTo} onchange={() => search()} />
				</label>
				<button class="btn btn-ghost btn-sm" onclick={clearFilters}>清除篩選</button>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else}
		<div class="text-sm text-base-content/70">
			共 {count} 筆，合計 <strong class="tabular-nums">{formatAmount(total)}</strong>
		</div>

		{#if sortedExpenses.length > 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body p-0">
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th class="cursor-pointer select-none" onclick={() => handleSort('expense_date')}>
										日期{sortIndicator('expense_date')}
									</th>
									<th class="cursor-pointer select-none" onclick={() => handleSort('normalized_category')}>
										分類{sortIndicator('normalized_category')}
									</th>
									<th class="cursor-pointer select-none text-right" onclick={() => handleSort('amount')}>
										金額{sortIndicator('amount')}
									</th>
									<th>固定</th>
									<th class="w-24"></th>
								</tr>
							</thead>
							<tbody>
								{#each sortedExpenses as exp}
									{#if editingId === exp.id}
										<tr class="bg-base-200">
											<td>
												<input type="date" class="input input-bordered input-xs w-36" bind:value={editDate} />
											</td>
											<td>
												<select class="select select-bordered select-xs w-40" bind:value={editCategoryId}>
													<option value={null}>未分類</option>
													{#each categories as group}
														<optgroup label={group.name}>
															{#each group.children as child}
																<option value={child.id}>{child.name}</option>
															{/each}
														</optgroup>
													{/each}
												</select>
											</td>
											<td>
												<input type="number" class="input input-bordered input-xs w-24 text-right" bind:value={editAmount} />
											</td>
											<td>
												<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editFixed} />
											</td>
											<td class="flex gap-1">
												<button class="btn btn-success btn-xs" onclick={saveEdit} disabled={saving}>存</button>
												<button class="btn btn-ghost btn-xs" onclick={cancelEdit}>取消</button>
											</td>
										</tr>
									{:else}
										<tr class="hover group">
											<td>{exp.expense_date}</td>
											<td>{exp.parent_category_name ? `${exp.parent_category_name} > ` : ''}{exp.normalized_category}</td>
											<td class="text-right tabular-nums">{formatAmount(exp.amount)}</td>
											<td>{exp.is_fixed_expense ? '是' : ''}</td>
											<td class="opacity-0 group-hover:opacity-100 transition-opacity">
												<div class="flex gap-1">
													<button class="btn btn-ghost btn-xs" onclick={() => startEdit(exp)}>編輯</button>
													<button class="btn btn-ghost btn-xs text-error" onclick={() => confirmDelete(exp.id)}>刪除</button>
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td colspan="2">合計</td>
									<td class="text-right tabular-nums">{formatAmount(total)}</td>
									<td></td>
									<td></td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<p class="text-base-content/50">無符合條件的資料。</p>
		{/if}
	{/if}
</div>

<!-- Delete confirm modal -->
{#if deletingId}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">確認刪除</h3>
			<p class="py-4">確定要刪除這筆支出嗎？此操作無法復原。</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (deletingId = null)}>取消</button>
				<button class="btn btn-error" onclick={doDelete} disabled={saving}>刪除</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={() => (deletingId = null)}></div>
	</div>
{/if}

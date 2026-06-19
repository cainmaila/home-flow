<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { SvelteSet } from 'svelte/reactivity';

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

	// --- Bulk selection ---
	const selected = new SvelteSet<string>();
	let bulkCategoryId = $state<number | null>(null);
	let showBulkDelete = $state(false);

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
		selected.clear();

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

	let allVisibleSelected = $derived(
		sortedExpenses.length > 0 && sortedExpenses.every((e) => selected.has(e.id))
	);

	function toggleSelectAll() {
		if (allVisibleSelected) selected.clear();
		else for (const e of sortedExpenses) selected.add(e.id);
	}

	// ponytail: bulk = loop the single-item API client-side. Add a bulk endpoint only if row counts make N requests slow.
	async function bulkSetCategory() {
		if (bulkCategoryId === null || selected.size === 0) return;
		saving = true;
		try {
			const results = await Promise.all(
				[...selected].map((id) => {
					const exp = expenses.find((e) => e.id === id);
					if (!exp) return Promise.resolve(null);
					return fetch(`/api/expenses/${id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							expense_date: exp.expense_date,
							amount: exp.amount,
							category_id: bulkCategoryId,
							is_fixed_expense: exp.is_fixed_expense
						})
					});
				})
			);
			const failed = results.filter((r) => r && !r.ok).length;
			if (failed) alert(`${failed} 筆套用失敗`);
			bulkCategoryId = null;
			await search();
		} finally {
			saving = false;
		}
	}

	async function bulkDelete() {
		saving = true;
		try {
			const results = await Promise.all(
				[...selected].map((id) => fetch(`/api/expenses/${id}`, { method: 'DELETE' }))
			);
			const failed = results.filter((r) => !r.ok).length;
			if (failed) alert(`${failed} 筆刪除失敗`);
			showBulkDelete = false;
			await search();
		} finally {
			saving = false;
		}
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

	function editKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
		else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
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

{#snippet sortIcon(field: typeof sortField)}
	{#if sortField === field}
		<svg class="inline-block w-3 h-3 align-middle text-primary {sortAsc ? 'rotate-180' : ''}" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M3 4.5 6 7.5 9 4.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	{/if}
{/snippet}

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
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60">
			<span class="loading loading-spinner loading-lg"></span> 載入中…
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else}
		<div class="text-sm text-base-content/70">
			共 {count} 筆，合計 <strong class="tabular-nums">{formatAmount(total)}</strong>
		</div>

		{#if selected.size > 0}
			<div class="flex flex-wrap items-center gap-2 rounded-box bg-base-100 p-3 shadow">
				<span class="text-sm font-semibold">已選 {selected.size} 筆</span>
				<select class="select select-bordered select-sm w-44" bind:value={bulkCategoryId}>
					<option value={null}>選擇分類…</option>
					{#each categories as group}
						<optgroup label={group.name}>
							{#each group.children as child}
								<option value={child.id}>{child.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				<button class="btn btn-primary btn-sm" onclick={bulkSetCategory} disabled={bulkCategoryId === null || saving}>套用分類</button>
				<button class="btn btn-error btn-sm" onclick={() => (showBulkDelete = true)} disabled={saving}>刪除選取</button>
				<button class="btn btn-ghost btn-sm" onclick={() => selected.clear()}>清除</button>
			</div>
		{/if}

		{#if sortedExpenses.length > 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body p-0">
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th class="w-8">
										<input type="checkbox" class="checkbox checkbox-xs" checked={allVisibleSelected} onchange={toggleSelectAll} aria-label="全選" />
									</th>
									<th class="cursor-pointer select-none" onclick={() => handleSort('expense_date')}>
										日期 {@render sortIcon('expense_date')}
									</th>
									<th class="cursor-pointer select-none" onclick={() => handleSort('normalized_category')}>
										分類 {@render sortIcon('normalized_category')}
									</th>
									<th class="cursor-pointer select-none text-right" onclick={() => handleSort('amount')}>
										金額 {@render sortIcon('amount')}
									</th>
									<th>固定</th>
									<th class="w-24"></th>
								</tr>
							</thead>
							<tbody>
								{#each sortedExpenses as exp}
									{#if editingId === exp.id}
										<tr class="bg-base-200 ring-2 ring-primary/40">
											<td></td>
											<td>
												<input type="date" class="input input-bordered input-xs w-36" bind:value={editDate} onkeydown={editKeydown} />
											</td>
											<td>
												<select class="select select-bordered select-xs w-40" bind:value={editCategoryId} onkeydown={editKeydown}>
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
												<input type="number" class="input input-bordered input-xs w-24 text-right" bind:value={editAmount} onkeydown={editKeydown} />
											</td>
											<td>
												<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editFixed} />
											</td>
											<td class="flex gap-1">
												<button class="btn btn-success btn-xs" onclick={saveEdit} disabled={saving}>儲存</button>
												<button class="btn btn-ghost btn-xs" onclick={cancelEdit}>取消</button>
											</td>
										</tr>
									{:else}
										<tr class="hover group" class:bg-base-200={selected.has(exp.id)}>
											<td>
												<input type="checkbox" class="checkbox checkbox-xs" checked={selected.has(exp.id)} onchange={() => (selected.has(exp.id) ? selected.delete(exp.id) : selected.add(exp.id))} aria-label="選取" />
											</td>
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
									<td colspan="3">合計</td>
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
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={() => (deletingId = null)}></button>
	</div>
{/if}

<!-- Bulk delete confirm modal -->
{#if showBulkDelete}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">確認刪除</h3>
			<p class="py-4">確定要刪除選取的 <strong>{selected.size}</strong> 筆支出嗎？此操作無法復原。</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showBulkDelete = false)}>取消</button>
				<button class="btn btn-error" onclick={bulkDelete} disabled={saving}>刪除</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={() => (showBulkDelete = false)}></button>
	</div>
{/if}

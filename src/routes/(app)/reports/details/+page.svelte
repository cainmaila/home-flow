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

	let expenses: {
		id: string;
		expense_date: string;
		raw_category: string;
		normalized_category: string;
		category_name?: string;
		parent_category_name?: string | null;
		amount: number;
		is_fixed_expense: boolean;
	}[] = $state([]);
	let total = $state(0);
	let count = $state(0);

	let sortField: 'expense_date' | 'normalized_category' | 'amount' = $state('expense_date');
	let sortAsc = $state(false);

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
				expenses: typeof expenses;
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

	onMount(async () => {
		const params = $page.url.searchParams;
		filterMonth = params.get('month') ?? '';
		filterCategory = params.get('category') ?? '';
		filterDateFrom = params.get('dateFrom') ?? '';
		filterDateTo = params.get('dateTo') ?? '';
		filterFixed = params.get('fixed') ?? '';

		await loadMeta();
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
								</tr>
							</thead>
							<tbody>
								{#each sortedExpenses as exp}
									<tr class="hover">
										<td>{exp.expense_date}</td>
										<td>{exp.parent_category_name ? `${exp.parent_category_name} > ` : ''}{exp.normalized_category}</td>
										<td class="text-right tabular-nums">{formatAmount(exp.amount)}</td>
										<td>{exp.is_fixed_expense ? '是' : ''}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td colspan="2">合計</td>
									<td class="text-right tabular-nums">{formatAmount(total)}</td>
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

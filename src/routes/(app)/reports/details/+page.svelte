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

	// Available months / categories (loaded from monthly report)
	let availableMonths: string[] = $state([]);
	let availableCategories: string[] = $state([]);

	// Results
	let expenses: {
		id: string;
		expense_date: string;
		raw_category: string;
		normalized_category: string;
		amount: number;
		is_fixed_expense: boolean;
	}[] = $state([]);
	let total = $state(0);
	let count = $state(0);

	// Sort
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
		// Read initial filters from URL query params
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

<div class="details-page">
	<h1>支出明細</h1>

	<!-- Filter controls -->
	<div class="filters">
		<div class="filter-row">
			<label>
				月份
				<select bind:value={filterMonth} onchange={() => search()}>
					<option value="">全部</option>
					{#each availableMonths as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</label>

			<label>
				分類
				<select bind:value={filterCategory} onchange={() => search()}>
					<option value="">全部</option>
					{#each availableCategories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
			</label>

			<label>
				固定支出
				<select bind:value={filterFixed} onchange={() => search()}>
					<option value="">全部</option>
					<option value="true">固定</option>
					<option value="false">非固定</option>
				</select>
			</label>
		</div>

		<div class="filter-row">
			<label>
				日期從
				<input type="date" bind:value={filterDateFrom} onchange={() => search()} />
			</label>
			<label>
				日期到
				<input type="date" bind:value={filterDateTo} onchange={() => search()} />
			</label>
			<button class="clear-btn" onclick={clearFilters}>清除篩選</button>
		</div>
	</div>

	{#if loading}
		<p>載入中...</p>
	{:else if errorMessage}
		<p class="error">{errorMessage}</p>
	{:else}
		<!-- Results summary -->
		<div class="summary">
			共 {count} 筆，合計 <strong>{formatAmount(total)}</strong>
		</div>

		{#if sortedExpenses.length > 0}
			<table>
				<thead>
					<tr>
						<th class="sortable" onclick={() => handleSort('expense_date')}>
							日期{sortIndicator('expense_date')}
						</th>
						<th class="sortable" onclick={() => handleSort('normalized_category')}>
							分類{sortIndicator('normalized_category')}
						</th>
						<th class="sortable" onclick={() => handleSort('amount')}>
							金額{sortIndicator('amount')}
						</th>
						<th>固定</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedExpenses as exp}
						<tr>
							<td>{exp.expense_date}</td>
							<td>{exp.normalized_category}</td>
							<td class="amount">{formatAmount(exp.amount)}</td>
							<td>{exp.is_fixed_expense ? '是' : ''}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="2"><strong>合計</strong></td>
						<td class="amount"><strong>{formatAmount(total)}</strong></td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		{:else}
			<p>無符合條件的資料。</p>
		{/if}
	{/if}

	<p class="nav-link"><a href="/reports">返回月報表</a></p>
</div>

<style>
	.details-page {
		max-width: 900px;
		margin: 40px auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}

	.filters {
		background: #f9f9f9;
		padding: 1rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
	}

	.filter-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.filter-row:last-child {
		margin-bottom: 0;
	}

	.filter-row label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.filter-row select,
	.filter-row input {
		padding: 0.3rem 0.5rem;
		font-size: 0.9rem;
	}

	.clear-btn {
		padding: 0.35rem 0.8rem;
		background: #eee;
		border: 1px solid #ccc;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.summary {
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}

	th, td {
		border: 1px solid #ddd;
		padding: 0.4rem 0.6rem;
		text-align: left;
	}

	th {
		background: #f5f5f5;
		font-size: 0.85rem;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		background: #e8e8e8;
	}

	td.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	tfoot td {
		border-top: 2px solid #999;
	}

	.error {
		color: #c00;
	}

	.nav-link {
		margin-top: 2rem;
		font-size: 0.9rem;
	}

	.nav-link a {
		color: #0066cc;
	}
</style>

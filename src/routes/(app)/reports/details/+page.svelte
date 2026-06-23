<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import type { CategoryParent, Expense } from '$lib/types';
	import { formatAmount, buildCategoryColorMap } from '$lib/utils';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import CategoryPicker from '$lib/components/CategoryPicker.svelte';
	import ExpenseTable from './ExpenseTable.svelte';
	import QuickAddRow from './QuickAddRow.svelte';

	// --- Filter state ---
	let filterMonth = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let filterCategoryId = $state<number | null>(null);
	let filterCategoryName = $state('');
	let filterTag = $state('');

	let loading = $state(true);
	let errorMessage = $state('');

	let availableMonths: string[] = $state([]);
	let expenses: Expense[] = $state([]);
	let total = $state(0);
	let count = $state(0);
	let saving = $state(false);

	let categories: CategoryParent[] = $state([]);
	let categoryColor = $derived(buildCategoryColorMap(categories));

	let availableTags: { id: number; name: string }[] = $state([]);
	let paymentMethods: { id: number; name: string }[] = $state([]);

	// --- Bulk selection ---
	const selected = new SvelteSet<string>();
	let bulkCategoryId = $state<number | null>(null);
	let showBulkDelete = $state(false);

	let selectedCategoryLabel = $derived.by(() => {
		if (filterCategoryId == null) return '';
		for (const g of categories) for (const c of g.children) if (c.id === filterCategoryId) return c.name;
		return filterCategoryName;
	});

	let selectedCategoryColor = $derived(filterCategoryId != null ? categoryColor.get(filterCategoryId) ?? null : null);

	let hasActiveFilters = $derived(
		!!filterMonth || filterCategoryId != null || !!filterCategoryName || !!filterTag || !!filterDateFrom || !!filterDateTo
	);

	async function loadMeta() {
		try {
			const res = await fetch('/api/reports/monthly');
			if (!res.ok) return;
			const data = (await res.json()) as { availableMonths?: string[] };
			availableMonths = data.availableMonths ?? [];
		} catch { /* non-blocking */ }
	}

	async function loadCategories() {
		try {
			const res = await fetch('/api/categories/manage');
			if (!res.ok) return;
			categories = await res.json();
		} catch { /* non-blocking */ }
	}

	async function loadTags() {
		try {
			const res = await fetch('/api/tags');
			if (!res.ok) return;
			availableTags = await res.json();
		} catch { /* non-blocking */ }
	}

	async function loadPaymentMethods() {
		try {
			const res = await fetch('/api/payment-methods');
			if (!res.ok) return;
			paymentMethods = await res.json();
		} catch { /* non-blocking */ }
	}

	async function search(showLoading = true) {
		if (showLoading) loading = true;
		errorMessage = '';
		selected.clear();

		const params = new URLSearchParams();
		if (filterMonth) params.set('month', filterMonth);
		if (filterDateFrom) params.set('dateFrom', filterDateFrom);
		if (filterDateTo) params.set('dateTo', filterDateTo);
		if (filterCategoryId != null) params.set('categoryId', String(filterCategoryId));
		else if (filterCategoryName) params.set('category', filterCategoryName);
		if (filterTag) params.set('tags', filterTag);

		try {
			const res = await fetch(`/api/expenses/search?${params}`);
			if (!res.ok) { errorMessage = '查詢失敗'; loading = false; return; }
			const data = (await res.json()) as { expenses: Expense[]; total: number; count: number };
			expenses = data.expenses;
			total = data.total;
			count = data.count;
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			loading = false;
		}
	}

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
							category_id: bulkCategoryId
						})
					});
				})
			);
			const failed = results.filter((r) => r && !r.ok).length;
			if (failed) alert(`${failed} 筆套用失敗`);
			bulkCategoryId = null;
			await search();
		} finally { saving = false; }
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
		} finally { saving = false; }
	}

	function exportCsv() {
		const esc = (v: string) => (/[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
		const header = '日期,父分類,分類,明細,金額,付款方式,標籤';
		const rows = expenses.map((e) =>
			[
				e.expense_date,
				esc(e.parent_category_name ?? ''),
				esc(e.normalized_category),
				esc(e.detail ?? ''),
				String(e.amount),
				esc(e.payment_method ?? '現金'),
				esc((e.tags ?? []).join('、'))
			].join(',')
		);
		const csv = '﻿' + header + '\n' + rows.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `支出明細_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function clearFilters() {
		filterMonth = ''; filterDateFrom = ''; filterDateTo = '';
		filterCategoryId = null; filterCategoryName = '';
		filterTag = '';
		search();
	}

	function selectCategory(id: number) {
		filterCategoryId = id;
		filterCategoryName = '';
		search();
	}

	function clearCategory() {
		filterCategoryId = null;
		filterCategoryName = '';
		search();
	}

	onMount(async () => {
		const params = $page.url.searchParams;
		filterMonth = params.get('month') ?? '';
		filterDateFrom = params.get('dateFrom') ?? '';
		filterDateTo = params.get('dateTo') ?? '';
		await Promise.all([loadMeta(), loadCategories(), loadTags(), loadPaymentMethods()]);

		const urlCategory = params.get('category') ?? '';
		if (urlCategory) {
			let found = false;
			for (const g of categories) {
				for (const c of g.children) {
					if (c.name === urlCategory) { filterCategoryId = c.id; found = true; break; }
				}
				if (found) break;
			}
			if (!found) filterCategoryName = urlCategory;
		}

		await search();
	});
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">支出明細</h1>

	<!-- Filters — compact control row -->
	<div class="flex flex-wrap gap-2 items-center">
		<select class="select select-bordered select-sm" bind:value={filterMonth} onchange={() => search()}>
			<option value="">月份</option>
			{#each availableMonths as m}
				<option value={m}>{m}</option>
			{/each}
		</select>

		<CategoryPicker
			{categories}
			selectedId={filterCategoryId}
			onselect={selectCategory}
			onclear={clearCategory}
		/>

		<select class="select select-bordered select-sm" bind:value={filterTag} onchange={() => search()}>
			<option value="">標籤</option>
			{#each availableTags as tag}
				<option value={tag.name}>{tag.name}</option>
			{/each}
		</select>

		<input type="date" class="input input-bordered input-sm" bind:value={filterDateFrom} onchange={() => search()} title="日期從" />
		<span class="text-base-content/30">–</span>
		<input type="date" class="input input-bordered input-sm" bind:value={filterDateTo} onchange={() => search()} title="日期到" />
	</div>

	<!-- Active filter chips -->
	{#if hasActiveFilters}
		<div class="flex flex-wrap gap-1.5 items-center">
			<span class="text-xs text-base-content/50 mr-1">已篩</span>
			{#if filterMonth}
				<button class="badge badge-sm gap-1 cursor-pointer hover:badge-error transition-colors" onclick={() => { filterMonth = ''; search(); }}>
					{filterMonth}<Icon icon={icons.close} class="text-xs" />
				</button>
			{/if}
			{#if filterCategoryId != null || filterCategoryName}
				<button class="badge badge-sm gap-1 cursor-pointer hover:badge-error transition-colors" onclick={clearCategory}>
					{#if selectedCategoryColor}<span class="w-1.5 h-1.5 rounded-full inline-block" style="background-color:{selectedCategoryColor}"></span>{/if}
					{selectedCategoryLabel || filterCategoryName}<Icon icon={icons.close} class="text-xs" />
				</button>
			{/if}
			{#if filterTag}
				<button class="badge badge-sm gap-1 cursor-pointer hover:badge-error transition-colors" onclick={() => { filterTag = ''; search(); }}>
					{filterTag}<Icon icon={icons.close} class="text-xs" />
				</button>
			{/if}
			{#if filterDateFrom || filterDateTo}
				<button class="badge badge-sm gap-1 cursor-pointer hover:badge-error transition-colors" onclick={() => { filterDateFrom = ''; filterDateTo = ''; search(); }}>
					{filterDateFrom || '…'}–{filterDateTo || '…'}<Icon icon={icons.close} class="text-xs" />
				</button>
			{/if}
			<button class="text-xs text-base-content/40 hover:text-error transition-colors ml-1" onclick={clearFilters}>清除全部</button>
		</div>
	{/if}

	{#if loading}
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60">
			<span class="loading loading-spinner loading-lg"></span> 載入中…
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else}
		<QuickAddRow onadded={() => search(false)} {paymentMethods} {categories} />

		<div class="flex items-center justify-between">
			<span class="text-sm text-base-content/70">共 {count} 筆，合計 <strong class="tabular-nums">{formatAmount(total)}</strong></span>
			<button class="btn btn-sm btn-outline gap-1" onclick={exportCsv} disabled={count === 0}>
				<Icon icon={icons.download} class="text-base" />匯出 CSV
			</button>
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
				<button class="btn btn-primary btn-sm gap-1" onclick={bulkSetCategory} disabled={bulkCategoryId === null || saving}><Icon icon={icons.confirm} class="text-base" />套用分類</button>
				<button class="btn btn-error btn-sm gap-1" onclick={() => (showBulkDelete = true)} disabled={saving}><Icon icon={icons.delete} class="text-base" />刪除選取</button>
				<button class="btn btn-ghost btn-sm gap-1" onclick={() => selected.clear()}><Icon icon={icons.close} class="text-base" />清除</button>
			</div>
		{/if}

		<ExpenseTable
			{expenses}
			{categories}
			{categoryColor}
			{selected}
			{availableTags}
			{paymentMethods}
			{total}
			bind:saving
			onrefresh={search}
		/>
	{/if}
</div>

<ConfirmModal
	open={showBulkDelete}
	title="確認刪除"
	message={`確定要刪除選取的 <strong>${selected.size}</strong> 筆支出嗎？此操作無法復原。`}
	confirmLabel="刪除"
	loading={saving}
	onconfirm={bulkDelete}
	oncancel={() => (showBulkDelete = false)}
/>

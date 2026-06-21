<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';

	// --- Filter state ---
	let filterMonth = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let filterCategoryId = $state<number | null>(null);
	let filterCategoryName = $state('');
	let filterFixed = $state(''); // '' | 'true' | 'false'
	let filterTag = $state('');

	// --- Category picker state ---
	let categoryPickerOpen = $state(false);
	let categorySearch = $state('');
	let pickerInputEl: HTMLInputElement | undefined = $state(undefined);

	let loading = $state(true);
	let errorMessage = $state('');

	let availableMonths: string[] = $state([]);

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
		detail?: string | null;
		tags?: string[];
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
	let editDetail = $state('');
	let editTags = $state('');
	let saving = $state(false);

	// --- Categories for edit dropdown ---
	interface CategoryChild { id: number; name: string; color?: string | null }
	interface CategoryGroup { id: number; name: string; children: CategoryChild[] }
	let categories: CategoryGroup[] = $state([]);

	// category_id → color, built from the loaded category tree (API carries color per child)
	let categoryColor = $derived.by(() => {
		const m = new Map<number, string>();
		for (const g of categories) for (const c of g.children) if (c.color) m.set(c.id, c.color);
		return m;
	});

	// --- Tags for filter + datalist ---
	let availableTags: { id: number; name: string }[] = $state([]);

	// --- Delete confirm ---
	let deletingId = $state<string | null>(null);

	// --- Bulk selection ---
	const selected = new SvelteSet<string>();
	let bulkCategoryId = $state<number | null>(null);
	let showBulkDelete = $state(false);

	function formatAmount(cents: number): string {
		return Math.round(cents).toLocaleString('zh-TW');
	}

	let selectedCategoryLabel = $derived.by(() => {
		if (filterCategoryId == null) return '';
		for (const g of categories) for (const c of g.children) if (c.id === filterCategoryId) return c.name;
		return filterCategoryName;
	});

	let selectedCategoryColor = $derived(filterCategoryId != null ? categoryColor.get(filterCategoryId) ?? null : null);

	let filteredPickerGroups = $derived.by(() => {
		const q = categorySearch.trim().toLowerCase();
		if (!q) return categories;
		return categories
			.map((g) => ({
				...g,
				children: g.children.filter((c) => c.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q))
			}))
			.filter((g) => g.children.length > 0);
	});

	let hasActiveFilters = $derived(
		!!filterMonth || filterCategoryId != null || !!filterCategoryName || !!filterFixed || !!filterTag || !!filterDateFrom || !!filterDateTo
	);

	async function loadMeta() {
		try {
			const res = await fetch('/api/reports/monthly');
			if (!res.ok) return;
			const data = (await res.json()) as { availableMonths?: string[] };
			availableMonths = data.availableMonths ?? [];
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

	async function loadTags() {
		try {
			const res = await fetch('/api/tags');
			if (!res.ok) return;
			availableTags = await res.json();
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
		if (filterCategoryId != null) params.set('categoryId', String(filterCategoryId));
		else if (filterCategoryName) params.set('category', filterCategoryName);
		if (filterFixed) params.set('fixed', filterFixed);
		if (filterTag) params.set('tags', filterTag);

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
		filterCategoryId = null;
		filterCategoryName = '';
		filterFixed = '';
		filterTag = '';
		search();
	}

	function selectCategory(id: number) {
		filterCategoryId = id;
		filterCategoryName = '';
		categoryPickerOpen = false;
		categorySearch = '';
		search();
	}

	function clearCategory() {
		filterCategoryId = null;
		filterCategoryName = '';
		search();
	}

	function startEdit(exp: Expense) {
		editingId = exp.id;
		editDate = exp.expense_date;
		editAmount = String(exp.amount);
		editCategoryId = exp.category_id ?? null;
		editFixed = exp.is_fixed_expense;
		editDetail = exp.detail ?? '';
		editTags = (exp.tags ?? []).join(',');
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
					is_fixed_expense: editFixed,
					detail: editDetail || null,
					tags: editTags ? editTags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
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
		filterDateFrom = params.get('dateFrom') ?? '';
		filterDateTo = params.get('dateTo') ?? '';
		filterFixed = params.get('fixed') ?? '';

		await Promise.all([loadMeta(), loadCategories(), loadTags()]);

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

{#snippet sortIcon(field: typeof sortField)}
	{#if sortField === field}
		<Icon icon={icons.sortChevron} class="inline-block text-sm align-middle text-primary {sortAsc ? 'rotate-180' : ''}" aria-hidden="true" />
	{/if}
{/snippet}

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

		<!-- Category picker trigger -->
		<div class="relative">
			<button
				class="btn btn-sm btn-outline gap-1.5 font-normal"
				onclick={() => { categoryPickerOpen = !categoryPickerOpen; categorySearch = ''; if (!categoryPickerOpen) return; requestAnimationFrame(() => pickerInputEl?.focus()); }}
			>
				{#if selectedCategoryColor}
					<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{selectedCategoryColor}"></span>
				{/if}
				{selectedCategoryLabel || '分類'}
				<Icon icon={icons.sortChevron} class="text-xs opacity-50" />
			</button>

			{#if categoryPickerOpen}
				<button type="button" class="fixed inset-0 z-10" aria-label="關閉" onclick={() => { categoryPickerOpen = false; categorySearch = ''; }}></button>
				<div class="absolute left-0 top-full mt-1 z-20 w-64 max-h-72 overflow-y-auto rounded-box bg-base-100 shadow-lg border border-base-300">
					<div class="sticky top-0 bg-base-100 p-2 border-b border-base-200">
						<input
							bind:this={pickerInputEl}
							bind:value={categorySearch}
							class="input input-bordered input-sm w-full"
							placeholder="搜尋分類…"
							onkeydown={(e) => { if (e.key === 'Escape') { categoryPickerOpen = false; categorySearch = ''; } }}
						/>
					</div>
					{#each filteredPickerGroups as group}
						<div class="px-3 pt-2 pb-1 text-xs font-semibold text-base-content/50 uppercase tracking-wide">{group.name}</div>
						{#each group.children as child}
							<button
								class="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-base-200 transition-colors {filterCategoryId === child.id ? 'bg-primary/10 font-semibold' : ''}"
								onclick={() => selectCategory(child.id)}
							>
								<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{child.color || 'var(--fallback-bc,oklch(0% 0 0/0.15))'}"></span>
								{child.name}
							</button>
						{/each}
					{/each}
					{#if filteredPickerGroups.length === 0}
						<div class="px-3 py-4 text-sm text-base-content/40 text-center">找不到符合的分類</div>
					{/if}
				</div>
			{/if}
		</div>

		<select class="select select-bordered select-sm" bind:value={filterFixed} onchange={() => search()}>
			<option value="">固定</option>
			<option value="true">固定</option>
			<option value="false">非固定</option>
		</select>

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
			{#if filterFixed}
				<button class="badge badge-sm gap-1 cursor-pointer hover:badge-error transition-colors" onclick={() => { filterFixed = ''; search(); }}>
					{filterFixed === 'true' ? '固定' : '非固定'}<Icon icon={icons.close} class="text-xs" />
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
				<button class="btn btn-primary btn-sm gap-1" onclick={bulkSetCategory} disabled={bulkCategoryId === null || saving}><Icon icon={icons.confirm} class="text-base" />套用分類</button>
				<button class="btn btn-error btn-sm gap-1" onclick={() => (showBulkDelete = true)} disabled={saving}><Icon icon={icons.delete} class="text-base" />刪除選取</button>
				<button class="btn btn-ghost btn-sm gap-1" onclick={() => selected.clear()}><Icon icon={icons.close} class="text-base" />清除</button>
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
									<th>明細</th>
									<th class="cursor-pointer select-none text-right" onclick={() => handleSort('amount')}>
										金額 {@render sortIcon('amount')}
									</th>
									<th>標籤</th>
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
												<input type="text" class="input input-bordered input-xs w-32" bind:value={editDetail} onkeydown={editKeydown} placeholder="明細" />
											</td>
											<td>
												<input type="number" class="input input-bordered input-xs w-24 text-right" bind:value={editAmount} onkeydown={editKeydown} />
											</td>
											<td>
												<input type="text" class="input input-bordered input-xs w-32" bind:value={editTags} onkeydown={editKeydown} placeholder="逗號分隔" list="tag-options" />
											</td>
											<td>
												<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editFixed} />
											</td>
											<td class="flex gap-1">
												<button class="btn btn-success btn-xs gap-0.5" onclick={saveEdit} disabled={saving}><Icon icon={icons.save} class="text-sm" />儲存</button>
												<button class="btn btn-ghost btn-xs gap-0.5" onclick={cancelEdit}><Icon icon={icons.cancel} class="text-sm" />取消</button>
											</td>
										</tr>
									{:else}
										<tr class="hover group" class:bg-base-200={selected.has(exp.id)}>
											<td>
												<input type="checkbox" class="checkbox checkbox-xs" checked={selected.has(exp.id)} onchange={() => (selected.has(exp.id) ? selected.delete(exp.id) : selected.add(exp.id))} aria-label="選取" />
											</td>
											<td class="tabular-nums text-base-content/70">{exp.expense_date}</td>
											<td>
												<span class="inline-flex items-center gap-1.5">
													{#if exp.category_id != null && categoryColor.get(exp.category_id)}
														<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{categoryColor.get(exp.category_id)}"></span>
													{:else}
														<span class="w-2 h-2 rounded-full inline-block shrink-0 bg-base-content/20"></span>
													{/if}
													<span>{#if exp.parent_category_name}<span class="text-base-content/45">{exp.parent_category_name} ›</span> {/if}{exp.normalized_category}</span>
												</span>
											</td>
											<td class="text-sm text-base-content/70">{exp.detail ?? ''}</td>
											<td class="text-right tabular-nums font-semibold">{formatAmount(exp.amount)}</td>
											<td class="space-x-1">{#each exp.tags ?? [] as tag}<span class="badge badge-sm badge-ghost rounded-full font-normal">{tag}</span>{/each}</td>
											<td class="text-center">{#if exp.is_fixed_expense}<Icon icon={icons.pin} class="text-base-content/50 text-sm" aria-label="固定支出" />{/if}</td>
											<td class="opacity-0 group-hover:opacity-100 transition-opacity">
												<div class="flex gap-1">
													<button class="btn btn-ghost btn-xs gap-0.5" onclick={() => startEdit(exp)}><Icon icon={icons.edit} class="text-sm" />編輯</button>
													<button class="btn btn-ghost btn-xs gap-0.5 text-error" onclick={() => confirmDelete(exp.id)}><Icon icon={icons.delete} class="text-sm" />刪除</button>
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
							<tfoot>
								<tr class="font-semibold">
									<td colspan="4">合計</td>
									<td class="text-right tabular-nums">{formatAmount(total)}</td>
									<td colspan="3"></td>
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
				<button class="btn btn-ghost gap-1" onclick={() => (deletingId = null)}><Icon icon={icons.cancel} class="text-base" />取消</button>
				<button class="btn btn-error gap-1" onclick={doDelete} disabled={saving}><Icon icon={icons.delete} class="text-base" />刪除</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={() => (deletingId = null)}></button>
	</div>
{/if}

<datalist id="tag-options">
	{#each availableTags as tag}
		<option value={tag.name}></option>
	{/each}
</datalist>

<!-- Bulk delete confirm modal -->
{#if showBulkDelete}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">確認刪除</h3>
			<p class="py-4">確定要刪除選取的 <strong>{selected.size}</strong> 筆支出嗎？此操作無法復原。</p>
			<div class="modal-action">
				<button class="btn btn-ghost gap-1" onclick={() => (showBulkDelete = false)}><Icon icon={icons.cancel} class="text-base" />取消</button>
				<button class="btn btn-error gap-1" onclick={bulkDelete} disabled={saving}><Icon icon={icons.delete} class="text-base" />刪除</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={() => (showBulkDelete = false)}></button>
	</div>
{/if}

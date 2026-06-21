<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import type { CategoryParent, Expense } from '$lib/types';
	import { formatAmount } from '$lib/utils';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import CategoryPicker from '$lib/components/CategoryPicker.svelte';

	let {
		expenses,
		categories,
		categoryColor,
		selected,
		availableTags,
		total,
		saving = $bindable(false),
		onrefresh
	}: {
		expenses: Expense[];
		categories: CategoryParent[];
		categoryColor: Map<number, string>;
		selected: SvelteSet<string>;
		availableTags: { id: number; name: string }[];
		total: number;
		saving: boolean;
		onrefresh: () => Promise<void>;
	} = $props();

	// --- Sort ---
	let sortField: 'expense_date' | 'normalized_category' | 'amount' = $state('expense_date');
	let sortAsc = $state(false);

	function handleSort(field: typeof sortField) {
		if (sortField === field) sortAsc = !sortAsc;
		else { sortField = field; sortAsc = true; }
	}

	let sortedExpenses = $derived.by(() => {
		const sorted = [...expenses];
		sorted.sort((a, b) => {
			let cmp = 0;
			if (sortField === 'expense_date') cmp = a.expense_date.localeCompare(b.expense_date);
			else if (sortField === 'normalized_category') cmp = a.normalized_category.localeCompare(b.normalized_category);
			else if (sortField === 'amount') cmp = a.amount - b.amount;
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

	// --- Per-cell edit state ---
	type EditField = 'date' | 'category' | 'detail' | 'amount' | 'tags';
	let editing = $state<{ id: string; field: EditField } | null>(null);
	let editValue = $state('');

	function startCell(exp: Expense, field: EditField) {
		if (saving) return;
		editing = { id: exp.id, field };
		if (field === 'date') editValue = exp.expense_date;
		else if (field === 'amount') editValue = String(exp.amount);
		else if (field === 'detail') editValue = exp.detail ?? '';
		else if (field === 'tags') editValue = (exp.tags ?? []).join(',');
	}

	function cancelCell() { editing = null; }

	function cellKeydown(e: KeyboardEvent, exp: Expense) {
		if (e.key === 'Enter') { e.preventDefault(); commitCell(exp); }
		else if (e.key === 'Escape') { e.preventDefault(); cancelCell(); }
	}

	async function commitCell(exp: Expense) {
		if (!editing) return;
		const { field } = editing;
		let body: Record<string, unknown> | null = null;

		if (field === 'date') {
			if (editValue && editValue !== exp.expense_date) body = { expense_date: editValue };
		} else if (field === 'amount') {
			const n = Number(editValue);
			if (!isNaN(n) && n >= 0 && n !== exp.amount) body = { amount: n };
		} else if (field === 'detail') {
			if (editValue !== (exp.detail ?? '')) body = { detail: editValue || null };
		} else if (field === 'tags') {
			const newTags = editValue.split(',').map(t => t.trim()).filter(Boolean);
			const oldTags = (exp.tags ?? []).join(',');
			if (newTags.join(',') !== oldTags) body = { tags: newTags };
		}

		editing = null;
		if (!body) return;

		saving = true;
		try {
			const res = await fetch(`/api/expenses/${exp.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) { alert(`儲存失敗: ${await res.text()}`); return; }
			await onrefresh();
		} finally { saving = false; }
	}

	async function commitCategory(expId: string, categoryId: number | null) {
		editing = null;
		saving = true;
		try {
			const res = await fetch(`/api/expenses/${expId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ category_id: categoryId })
			});
			if (!res.ok) { alert(`儲存失敗: ${await res.text()}`); return; }
			await onrefresh();
		} finally { saving = false; }
	}

	function focusOnMount(node: HTMLElement) { node.focus(); }

	// --- Delete ---
	let deletingId = $state<string | null>(null);

	function confirmDelete(id: string) { deletingId = id; }

	async function doDelete() {
		if (!deletingId) return;
		saving = true;
		try {
			const res = await fetch(`/api/expenses/${deletingId}`, { method: 'DELETE' });
			if (!res.ok) { alert(`刪除失敗: ${await res.text()}`); return; }
			deletingId = null;
			await onrefresh();
		} finally { saving = false; }
	}
</script>

{#snippet sortIcon(field: typeof sortField)}
	{#if sortField === field}
		<Icon icon={icons.sortChevron} class="inline-block text-sm align-middle text-primary {sortAsc ? 'rotate-180' : ''}" aria-hidden="true" />
	{/if}
{/snippet}

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
							<th class="w-24"></th>
						</tr>
					</thead>
					<tbody>
						{#each sortedExpenses as exp}
							<tr class="hover group" class:bg-base-200={selected.has(exp.id)}>
								<td>
									<input type="checkbox" class="checkbox checkbox-xs" checked={selected.has(exp.id)} onchange={() => (selected.has(exp.id) ? selected.delete(exp.id) : selected.add(exp.id))} aria-label="選取" />
								</td>
								<td class="cursor-pointer" onclick={() => startCell(exp, 'date')}>
									{#if editing?.id === exp.id && editing.field === 'date'}
										<input use:focusOnMount type="date" class="input input-bordered input-xs w-36" bind:value={editValue} onkeydown={(e) => cellKeydown(e, exp)} onblur={() => commitCell(exp)} />
									{:else}
										<span class="tabular-nums text-base-content/70">{exp.expense_date}</span>
									{/if}
								</td>
								<td class="cursor-pointer" onclick={() => { if (editing?.id !== exp.id || editing.field !== 'category') startCell(exp, 'category'); }}>
									{#if editing?.id === exp.id && editing.field === 'category'}
										<CategoryPicker
											{categories}
											selectedId={exp.category_id ?? null}
											placeholder="未分類"
											size="xs"
											allowClear
											autoOpen
											onselect={(id) => commitCategory(exp.id, id)}
											onclear={() => commitCategory(exp.id, null)}
											onclose={cancelCell}
										/>
									{:else}
										<span class="inline-flex items-center gap-1.5">
											{#if exp.category_id != null && categoryColor.get(exp.category_id)}
												<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{categoryColor.get(exp.category_id)}"></span>
											{:else}
												<span class="w-2 h-2 rounded-full inline-block shrink-0 bg-base-content/20"></span>
											{/if}
											<span>{#if exp.parent_category_name}<span class="text-base-content/45">{exp.parent_category_name} ›</span> {/if}{exp.normalized_category}</span>
										</span>
									{/if}
								</td>
								<td class="cursor-pointer" onclick={() => startCell(exp, 'detail')}>
									{#if editing?.id === exp.id && editing.field === 'detail'}
										<input use:focusOnMount type="text" class="input input-bordered input-xs w-32" bind:value={editValue} onkeydown={(e) => cellKeydown(e, exp)} onblur={() => commitCell(exp)} placeholder="明細" />
									{:else}
										<span class="text-sm text-base-content/70">{exp.detail ?? ''}</span>
									{/if}
								</td>
								<td class="cursor-pointer" onclick={() => startCell(exp, 'amount')}>
									{#if editing?.id === exp.id && editing.field === 'amount'}
										<input use:focusOnMount type="number" class="input input-bordered input-xs w-24 text-right" bind:value={editValue} onkeydown={(e) => cellKeydown(e, exp)} onblur={() => commitCell(exp)} />
									{:else}
										<span class="text-right tabular-nums font-semibold">{formatAmount(exp.amount)}</span>
									{/if}
								</td>
								<td class="cursor-pointer" onclick={() => startCell(exp, 'tags')}>
									{#if editing?.id === exp.id && editing.field === 'tags'}
										<input use:focusOnMount type="text" class="input input-bordered input-xs w-32" bind:value={editValue} onkeydown={(e) => cellKeydown(e, exp)} onblur={() => commitCell(exp)} placeholder="逗號分隔" list="tag-options" />
									{:else}
										<span class="space-x-1">{#each exp.tags ?? [] as tag}<span class="badge badge-sm badge-ghost rounded-full font-normal">{tag}</span>{/each}</span>
									{/if}
								</td>
								<td class="opacity-0 group-hover:opacity-100 transition-opacity">
									<button class="btn btn-ghost btn-xs gap-0.5 text-error" onclick={() => confirmDelete(exp.id)}><Icon icon={icons.delete} class="text-sm" />刪除</button>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="font-semibold">
							<td colspan="4">合計</td>
							<td class="text-right tabular-nums">{formatAmount(total)}</td>
							<td colspan="2"></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	</div>
{:else}
	<p class="text-base-content/50">無符合條件的資料。</p>
{/if}

<ConfirmModal
	open={!!deletingId}
	title="確認刪除"
	message="確定要刪除這筆支出嗎？此操作無法復原。"
	confirmLabel="刪除"
	loading={saving}
	onconfirm={doDelete}
	oncancel={() => (deletingId = null)}
/>

<datalist id="tag-options">
	{#each availableTags as tag}
		<option value={tag.name}></option>
	{/each}
</datalist>

<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import type { CategoryParent, Expense } from '$lib/types';
	import { formatAmount } from '$lib/utils';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

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

	// --- Edit state ---
	let editingId = $state<string | null>(null);
	let editDate = $state('');
	let editAmount = $state('');
	let editCategoryId = $state<number | null>(null);
	let editFixed = $state(false);
	let editDetail = $state('');
	let editTags = $state('');

	function startEdit(exp: Expense) {
		editingId = exp.id;
		editDate = exp.expense_date;
		editAmount = String(exp.amount);
		editCategoryId = exp.category_id ?? null;
		editFixed = exp.is_fixed_expense;
		editDetail = exp.detail ?? '';
		editTags = (exp.tags ?? []).join(',');
	}

	function cancelEdit() { editingId = null; }

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
			if (!res.ok) { alert(`儲存失敗: ${await res.text()}`); return; }
			editingId = null;
			await onrefresh();
		} finally { saving = false; }
	}

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

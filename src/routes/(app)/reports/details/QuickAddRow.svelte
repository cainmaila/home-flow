<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import PaymentMethodPicker from '$lib/components/PaymentMethodPicker.svelte';
	import type { CategoryParent } from '$lib/types';
	import { fetchCategoryByDetail } from '$lib/utils';

	let { onadded, paymentMethods = [], categories = [] }: { onadded: () => Promise<void>; paymentMethods?: { id: number; name: string }[]; categories?: CategoryParent[] } = $props();

	let date = $state(new Date().toISOString().slice(0, 10));
	let detail = $state('');
	let amount = $state('');
	let categoryId = $state<number | null>(null);
	let categoryAuto = $state(false);
	let paymentMethod = $state('現金');
	let saving = $state(false);
	let feedback = $state('');

	let detailEl: HTMLInputElement | undefined = $state();
	let amountEl: HTMLInputElement | undefined = $state();

	async function lookupCategory() {
		if (categoryId != null && !categoryAuto) return; // 尊重手選
		const id = await fetchCategoryByDetail(detail);
		if (id != null) { categoryId = id; categoryAuto = true; }
	}

	async function add() {
		const n = Number(amount);
		if (!n || n <= 0) return;
		saving = true;
		feedback = '';
		try {
			const res = await fetch('/api/expenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					expense_date: date,
					amount: n,
					category_id: categoryId ?? undefined,
					detail: detail || undefined,
					payment_method: paymentMethod
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => null) as { message?: string } | null;
				feedback = `失敗: ${err?.message ?? res.statusText}`;
				return;
			}
			feedback = '✓ 已新增';
			detail = '';
			amount = '';
			categoryId = null;
			categoryAuto = false;
			paymentMethod = '現金';
			await onadded();
			requestAnimationFrame(() => detailEl?.focus());
		} catch {
			feedback = '網路錯誤';
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-wrap gap-2 items-center">
	<input type="date" class="input input-bordered input-sm w-36" bind:value={date} />
	<input
		bind:this={detailEl}
		type="text"
		class="input input-bordered input-sm w-40"
		placeholder="明細"
		bind:value={detail}
		onblur={lookupCategory}
		onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); amountEl?.focus(); } }}
	/>
	<select class="select select-bordered select-sm w-32" bind:value={categoryId} onchange={() => categoryAuto = false}>
		<option value={null}>分類</option>
		{#each categories as group}
			<optgroup label={group.name}>
				{#each group.children as child}
					<option value={child.id}>{child.name}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
	<input
		bind:this={amountEl}
		type="number"
		inputmode="decimal"
		class="input input-bordered input-sm w-24"
		placeholder="金額"
		min="1"
		bind:value={amount}
		onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
	/>
	{#if paymentMethods.length > 0}
		<PaymentMethodPicker methods={paymentMethods} bind:value={paymentMethod} size="xs" />
	{/if}
	<button class="btn btn-primary btn-sm gap-1" onclick={add} disabled={saving || !amount}>
		{#if saving}
			<span class="loading loading-spinner loading-xs"></span>
		{:else}
			<Icon icon={icons.add} class="text-base" />
		{/if}
		新增
	</button>
	{#if feedback}
		<span class="text-sm" class:text-success={feedback.startsWith('✓')} class:text-error={!feedback.startsWith('✓')}>{feedback}</span>
	{/if}
</div>

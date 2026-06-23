<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import { tagColor } from '$lib/tagColor';

	let methods: { id: number; name: string }[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let success = $state('');
	let newName = $state('');
	let saving = $state(false);
	let deletingId: number | null = $state(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/payment-methods');
			if (!res.ok) { error = '載入失敗'; return; }
			methods = await res.json();
		} catch { error = '網路錯誤'; }
		finally { loading = false; }
	}

	$effect(() => { load(); });

	$effect(() => {
		if (!success) return;
		const t = setTimeout(() => (success = ''), 3000);
		return () => clearTimeout(t);
	});

	async function add() {
		const name = newName.trim();
		if (!name) return;
		saving = true;
		try {
			const res = await fetch('/api/payment-methods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => null) as { message?: string } | null;
				error = err?.message ?? '新增失敗';
				return;
			}
			newName = '';
			success = '已新增';
			await load();
		} catch { error = '網路錯誤'; }
		finally { saving = false; }
	}

	async function doDelete() {
		if (deletingId == null) return;
		saving = true;
		try {
			const res = await fetch(`/api/payment-methods?id=${deletingId}`, { method: 'DELETE' });
			if (!res.ok) { error = '刪除失敗'; return; }
			deletingId = null;
			success = '已刪除';
			await load();
		} catch { error = '網路錯誤'; }
		finally { saving = false; }
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">付款方式管理</h1>

	{#if error}
		<div class="alert alert-error text-sm">{error}</div>
	{/if}
	{#if success}
		<div class="alert alert-success text-sm">{success}</div>
	{/if}

	{#if loading}
		<div class="flex justify-center py-12"><span class="loading loading-spinner loading-lg"></span></div>
	{:else}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<div class="flex flex-wrap gap-2 items-center mb-4">
					<input
						type="text"
						class="input input-bordered input-sm w-40"
						placeholder="新付款方式名稱"
						bind:value={newName}
						maxlength="20"
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
					/>
					<button class="btn btn-primary btn-sm gap-1" onclick={add} disabled={saving || !newName.trim()}>
						<Icon icon={icons.add} class="text-base" />新增
					</button>
				</div>

				{#if methods.length === 0}
					<p class="text-base-content/50">尚無付款方式。</p>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each methods as m}
							<Tag label={m.name} color={tagColor(m.name)} variant="filled" removable onremove={() => (deletingId = m.id)} />
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<ConfirmModal
	open={!!deletingId}
	title="確認刪除"
	message="刪除後不影響已記錄的支出，但無法再從清單選擇此付款方式。"
	confirmLabel="刪除"
	loading={saving}
	onconfirm={doDelete}
	oncancel={() => (deletingId = null)}
/>

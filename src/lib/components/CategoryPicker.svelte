<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import type { CategoryParent } from '$lib/types';

	let {
		categories,
		selectedId = null,
		placeholder = '分類',
		size = 'sm',
		allowClear = false,
		onselect,
		onclear
	}: {
		categories: CategoryParent[];
		selectedId: number | null;
		placeholder?: string;
		size?: 'sm' | 'xs';
		allowClear?: boolean;
		onselect: (id: number) => void;
		onclear: () => void;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let btnEl: HTMLButtonElement | undefined = $state(undefined);
	let pos = $state({ top: 0, left: 0 });

	let selectedLabel = $derived.by(() => {
		if (selectedId == null) return '';
		for (const g of categories) for (const c of g.children) if (c.id === selectedId) return c.name;
		return '';
	});

	let selectedColor = $derived.by(() => {
		if (selectedId == null) return null;
		for (const g of categories) for (const c of g.children) if (c.id === selectedId) return c.color ?? null;
		return null;
	});

	let filteredGroups = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return categories;
		return categories
			.map((g) => ({
				...g,
				children: g.children.filter((c) => c.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q))
			}))
			.filter((g) => g.children.length > 0);
	});

	function toggle() {
		open = !open;
		search = '';
		if (open) {
			if (btnEl) {
				const rect = btnEl.getBoundingClientRect();
				pos = { top: rect.bottom + 4, left: rect.left };
			}
			requestAnimationFrame(() => inputEl?.focus());
		}
	}

	function select(id: number) {
		open = false;
		search = '';
		onselect(id);
	}

	function clear() {
		open = false;
		search = '';
		onclear();
	}

	function close() {
		open = false;
		search = '';
	}
</script>

<div class="relative">
	<button bind:this={btnEl} class="btn btn-{size} btn-outline gap-1.5 font-normal" onclick={toggle}>
		{#if selectedColor}
			<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{selectedColor}"></span>
		{/if}
		{selectedLabel || placeholder}
		<Icon icon={icons.sortChevron} class="text-xs opacity-50" />
	</button>

	{#if open}
		<button type="button" class="fixed inset-0 z-10" aria-label="關閉" onclick={close}></button>
		<div class="fixed z-20 w-72 max-h-80 overflow-y-auto rounded-box bg-base-100 shadow-lg border border-base-300" style="top:{pos.top}px;left:{pos.left}px">
			<div class="sticky top-0 bg-base-100 p-2 border-b border-base-200">
				<input
					bind:this={inputEl}
					bind:value={search}
					class="input input-bordered input-xs w-full"
					placeholder="搜尋分類…"
					onkeydown={(e) => { if (e.key === 'Escape') close(); }}
				/>
			</div>
			{#if allowClear}
				<button
					class="w-full text-left px-3 py-1.5 text-sm text-base-content/60 hover:bg-base-200 transition-colors"
					onclick={clear}
				>未分類</button>
			{/if}
			{#each filteredGroups as group}
				<div class="px-3 pt-2 pb-1 text-xs font-semibold text-base-content/50 tracking-wide">{group.name}</div>
				<div class="px-2 pb-1 flex flex-wrap gap-1">
					{#each group.children as child}
						<button
							class="btn btn-xs gap-1 font-normal {selectedId === child.id ? 'btn-primary' : 'btn-ghost'}"
							onclick={() => select(child.id)}
						>
							<span class="w-2 h-2 rounded-full inline-block shrink-0" style="background-color:{child.color || 'var(--fallback-bc,oklch(0% 0 0/0.15))'}"></span>
							{child.name}
						</button>
					{/each}
				</div>
			{/each}
			{#if filteredGroups.length === 0}
				<div class="px-3 py-4 text-sm text-base-content/40 text-center">找不到符合的分類</div>
			{/if}
		</div>
	{/if}
</div>

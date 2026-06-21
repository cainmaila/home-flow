<script lang="ts">
	import Icon from '@iconify/svelte';
	import { CATEGORY_ICONS } from '$lib/icons';

	let {
		selected = '',
		size = 'sm',
		onselect
	}: {
		selected: string;
		size?: 'xs' | 'sm';
		onselect: (icon: string) => void;
	} = $props();
</script>

<div class="flex flex-wrap gap-1 p-2 bg-base-200 rounded-lg {size === 'xs' ? 'max-w-xs' : 'max-w-sm'}">
	{#each CATEGORY_ICONS as icon}
		<button
			class="btn btn-ghost {size === 'xs' ? 'btn-xs text-base px-1' : 'btn-sm text-lg px-1.5'}"
			class:btn-active={selected === icon}
			onclick={() => onselect(icon)}
		><Icon {icon} /></button>
	{/each}
</div>

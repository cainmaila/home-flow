<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { TagColor } from '$lib/tagColor';

	type TagVariant = 'outline' | 'filled';

	let {
		label,
		color = 'gray',
		variant = 'outline',
		icon,
		removable = false,
		size = 'sm',
		onremove
	}: {
		label: string;
		color?: TagColor;
		variant?: TagVariant;
		icon?: string;
		removable?: boolean;
		size?: 'xs' | 'sm';
		onremove?: () => void;
	} = $props();

	const styles: Record<TagColor, Record<TagVariant, string>> = {
		orange: {
			outline: 'border-orange-400 text-orange-600 bg-orange-50',
			filled: 'bg-orange-500 text-white border-orange-500'
		},
		green: {
			outline: 'border-green-500 text-green-700 bg-green-50',
			filled: 'bg-green-600 text-white border-green-600'
		},
		teal: {
			outline: 'border-teal-400 text-teal-600 bg-teal-50',
			filled: 'bg-teal-500 text-white border-teal-500'
		},
		gray: {
			outline: 'border-gray-300 text-gray-500 bg-gray-50',
			filled: 'bg-gray-400 text-white border-gray-400'
		},
		purple: {
			outline: 'border-purple-400 text-purple-600 bg-purple-50',
			filled: 'bg-purple-500 text-white border-purple-500'
		},
		red: {
			outline: 'border-red-400 text-red-600 bg-red-50',
			filled: 'bg-red-500 text-white border-red-500'
		},
		blue: {
			outline: 'border-blue-400 text-blue-600 bg-blue-50',
			filled: 'bg-blue-500 text-white border-blue-500'
		}
	};

	let cls = $derived(styles[color]?.[variant] ?? styles.gray.outline);
	let sizeClass = $derived(size === 'xs' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-3 py-1 gap-1.5');
</script>

<span class="inline-flex items-center rounded-full border font-medium {cls} {sizeClass}">
	{#if icon}
		<Icon {icon} class={size === 'xs' ? 'text-xs' : 'text-sm'} />
	{/if}
	{label}
	{#if removable}
		<button type="button" class="cursor-pointer opacity-60 hover:opacity-100" onclick={onremove}>
			<Icon icon="mdi:close" class={size === 'xs' ? 'text-xs' : 'text-sm'} />
		</button>
	{/if}
</span>

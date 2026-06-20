<script lang="ts">
	import Icon from '@iconify/svelte';
	let { icon, class: cls = '' }: { icon: string | null; class?: string } = $props();
</script>

{#if icon?.startsWith('mdi:')}
	<Icon {icon} class={cls} />
{:else if icon}
	<span class={cls}>{icon}</span>
{/if}

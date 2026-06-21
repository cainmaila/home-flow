<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';

	let {
		open = false,
		title = '確認',
		message = '',
		confirmLabel = '確認',
		confirmClass = 'btn-error',
		loading = false,
		onconfirm,
		oncancel
	}: {
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		confirmClass?: string;
		loading?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

{#if open}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">{title}</h3>
			<p class="py-4">{@html message}</p>
			<div class="modal-action">
				<button class="btn btn-ghost gap-1" onclick={oncancel}><Icon icon={icons.cancel} class="text-base" />取消</button>
				<button class="btn {confirmClass} gap-1" onclick={onconfirm} disabled={loading}><Icon icon={icons.delete} class="text-base" />{confirmLabel}</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={oncancel}></button>
	</div>
{/if}

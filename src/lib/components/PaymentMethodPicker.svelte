<script lang="ts">
	let {
		methods,
		value = $bindable('現金'),
		size = 'sm',
		onselect
	}: {
		methods: { id: number; name: string }[];
		value: string;
		size?: 'xs' | 'sm';
		onselect?: (name: string) => void;
	} = $props();

	function pick(name: string) {
		value = name;
		onselect?.(name);
	}
</script>

<div class="flex flex-wrap gap-1">
	{#each methods as m}
		<button
			type="button"
			class="btn btn-{size} {value === m.name ? 'btn-primary' : 'btn-ghost border-base-300'}"
			onclick={() => pick(m.name)}
		>
			{m.name}
		</button>
	{/each}
</div>

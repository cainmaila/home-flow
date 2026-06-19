<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="home">
	<h1>Home Flow</h1>

	{#if data.user}
		<p>歡迎，{data.user.name}（{data.user.role}）</p>
		<form method="POST" action="/auth/logout">
			<button type="submit">登出</button>
		</form>
	{/if}
</div>

<style>
	.home {
		max-width: 480px;
		margin: 80px auto;
		font-family: system-ui, sans-serif;
	}

	button {
		margin-top: 1rem;
		padding: 0.4rem 1rem;
		cursor: pointer;
	}
</style>

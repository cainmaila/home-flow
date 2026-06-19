<script lang="ts">
	import { page } from '$app/state';

	const error = $derived(page.url.searchParams.get('error'));
</script>

<div class="login">
	<h1>Home Flow</h1>

	{#if error === 'not_allowed'}
		<p class="error">此帳號不在允許名單中</p>
	{:else if error}
		<p class="error">登入失敗，請再試一次</p>
	{/if}

	<a href="/auth/login" class="btn">Login with Google</a>
</div>

<style>
	.login {
		max-width: 360px;
		margin: 120px auto;
		text-align: center;
		font-family: system-ui, sans-serif;
	}

	h1 {
		margin-bottom: 1.5rem;
	}

	.error {
		color: #c00;
		margin-bottom: 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.6rem 1.5rem;
		background: #4285f4;
		color: #fff;
		text-decoration: none;
		border-radius: 4px;
	}

	.btn:hover {
		background: #3367d6;
	}
</style>

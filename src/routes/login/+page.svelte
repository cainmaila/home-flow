<script lang="ts">
	import { page } from '$app/state';

	const error = $derived(page.url.searchParams.get('error'));
</script>

<div class="min-h-screen flex items-center justify-center bg-base-200">
	<div class="card bg-base-100 shadow-xl w-full max-w-sm">
		<div class="card-body items-center text-center">
			<h1 class="card-title text-3xl font-bold">Home Flow</h1>
			<p class="text-base-content/60">家庭支出管理</p>

			{#if error === 'not_allowed'}
				<div class="alert alert-error text-sm">此帳號不在允許名單中</div>
			{:else if error}
				<div class="alert alert-error text-sm">登入失敗，請再試一次</div>
			{/if}

			<div class="card-actions mt-4">
				<a href="/auth/login" class="btn btn-primary">Login with Google</a>
			</div>
		</div>
	</div>
</div>

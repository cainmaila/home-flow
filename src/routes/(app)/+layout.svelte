<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-base-200">
	<div class="navbar bg-neutral text-neutral-content shadow-lg">
		<div class="navbar-start">
			<div class="dropdown">
				<div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
					</svg>
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<ul tabindex="0" class="menu menu-sm dropdown-content bg-neutral rounded-box z-10 mt-3 w-52 p-2 shadow">
					<li><a href="/reports">月報</a></li>
					<li><a href="/reports/details">明細</a></li>
					<li><a href="/import">匯入</a></li>
					<li><a href="/corrections">校正</a></li>
					<li><a href="/import/history">歷程</a></li>
					<li><a href="/settings/categories">分類</a></li>
				</ul>
			</div>
			<a href="/reports" class="btn btn-ghost text-xl">Home Flow</a>
		</div>
		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
				<li><a href="/reports">月報</a></li>
				<li><a href="/reports/details">明細</a></li>
				<li><a href="/import">匯入</a></li>
				<li><a href="/corrections">校正</a></li>
				<li><a href="/import/history">歷程</a></li>
					<li><a href="/settings/categories">分類</a></li>
			</ul>
		</div>
		<div class="navbar-end">
			<a href="/auth/logout" class="btn btn-ghost btn-sm">登出</a>
		</div>
	</div>

	<main class="max-w-5xl mx-auto p-4 md:p-6">
		{@render children()}
	</main>
</div>

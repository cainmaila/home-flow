<script lang="ts">
	import { page } from '$app/stores';
	let { children } = $props();

	const links = [
		{ href: '/reports', label: '月報' },
		{ href: '/reports/details', label: '明細' },
		{ href: '/import', label: '匯入' },
		{ href: '/corrections', label: '校正' },
		{ href: '/import/history', label: '歷程' },
		{ href: '/settings/categories', label: '分類' }
	];

	// corporate theme's menu-active bg == navbar neutral bg, so it's invisible here.
	// Use a visible light pill instead.
	const activeCls = (href: string) =>
		$page.url.pathname === href ? 'bg-white/15 font-semibold' : '';
</script>

<div class="min-h-screen bg-base-200">
	<div class="navbar bg-neutral text-neutral-content shadow-lg">
		<div class="navbar-start">
			<div class="dropdown">
				<div tabindex="0" role="button" aria-label="開啟選單" aria-haspopup="menu" class="btn btn-ghost lg:hidden">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
					</svg>
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<ul tabindex="0" class="menu menu-sm dropdown-content bg-neutral rounded-box z-10 mt-3 w-52 p-2 shadow">
					{#each links as link}
						<li><a href={link.href} class={activeCls(link.href)}>{link.label}</a></li>
					{/each}
				</ul>
			</div>
			<a href="/reports" class="btn btn-ghost text-xl">Home Flow</a>
		</div>
		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
				{#each links as link}
					<li><a href={link.href} class={activeCls(link.href)}>{link.label}</a></li>
				{/each}
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

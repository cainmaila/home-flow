<script lang="ts">
	import { page } from '$app/stores';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import AddExpenseModal from '$lib/components/AddExpenseModal.svelte';
	let { children } = $props();

	const links = [
		{ href: '/reports', label: '月報', icon: icons.nav.reports },
		{ href: '/reports/details', label: '明細', icon: icons.nav.details },
		{ href: '/import', label: '匯入', icon: icons.nav.import },
		{ href: '/corrections', label: '校正', icon: icons.nav.corrections },
		{ href: '/import/history', label: '歷程', icon: icons.nav.history },
		{ href: '/settings/categories', label: '分類', icon: icons.nav.categories },
		{ href: '/settings/payments', label: '付款', icon: icons.nav.payments }
	];

	const activeCls = (href: string) =>
		$page.url.pathname === href ? 'bg-white/15 font-semibold' : '';
</script>

<div class="min-h-screen bg-base-200">
	<div class="navbar bg-neutral text-neutral-content shadow-lg">
		<div class="navbar-start">
			<div class="dropdown">
				<div tabindex="0" role="button" aria-label="開啟選單" aria-haspopup="menu" class="btn btn-ghost lg:hidden">
					<Icon icon={icons.menu} class="text-xl" />
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<ul tabindex="0" class="menu menu-sm dropdown-content bg-neutral rounded-box z-10 mt-3 w-52 p-2 shadow">
					{#each links as link}
						<li><a href={link.href} class="flex items-center gap-2 {activeCls(link.href)}"><Icon icon={link.icon} class="text-lg" />{link.label}</a></li>
					{/each}
				</ul>
			</div>
			<a href="/reports" class="btn btn-ghost text-xl">Home Flow</a>
		</div>
		<div class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
				{#each links as link}
					<li><a href={link.href} class="flex items-center gap-1 {activeCls(link.href)}"><Icon icon={link.icon} class="text-lg" />{link.label}</a></li>
				{/each}
			</ul>
		</div>
		<div class="navbar-end gap-1">
			<AddExpenseModal />
			<a href="/auth/logout" class="btn btn-ghost btn-sm gap-1"><Icon icon={icons.logout} class="text-lg" />登出</a>
		</div>
	</div>

	<main class="max-w-5xl mx-auto p-4 md:p-6">
		{@render children()}
	</main>
</div>

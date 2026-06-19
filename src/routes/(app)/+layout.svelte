<script lang="ts">
	let { children } = $props();
	let menuOpen = $state(false);

	function toggleMenu() {
		menuOpen = !menuOpen;
	}

	function closeMenu() {
		menuOpen = false;
	}
</script>

<div class="app-shell">
	<nav class="app-nav">
		<a href="/reports" class="nav-brand">Home Flow</a>
		<button class="menu-toggle" onclick={toggleMenu} aria-label="選單">
			{menuOpen ? '✕' : '☰'}
		</button>
		<div class="nav-links" class:open={menuOpen}>
			<a href="/reports" onclick={closeMenu}>月報</a>
			<a href="/reports/details" onclick={closeMenu}>明細</a>
			<a href="/import" onclick={closeMenu}>匯入</a>
			<a href="/corrections" onclick={closeMenu}>校正</a>
			<a href="/import/history" onclick={closeMenu}>歷程</a>
		</div>
	</nav>

	<main class="app-main">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		min-height: 100dvh;
		font-family: system-ui, sans-serif;
	}

	.app-nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: #fff;
		flex-wrap: wrap;
	}

	.nav-brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: #fff;
		text-decoration: none;
		margin-right: auto;
	}

	.menu-toggle {
		display: none;
		background: none;
		border: none;
		color: #fff;
		font-size: 1.4rem;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
	}

	.nav-links {
		display: flex;
		gap: 0.25rem;
	}

	.nav-links a {
		color: #ccd;
		text-decoration: none;
		padding: 0.4rem 0.7rem;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.nav-links a:hover {
		background: rgba(255,255,255,0.1);
		color: #fff;
	}

	.app-main {
		padding: 1rem;
	}

	@media (max-width: 640px) {
		.menu-toggle {
			display: block;
		}

		.nav-links {
			display: none;
			width: 100%;
			flex-direction: column;
			gap: 0;
		}

		.nav-links.open {
			display: flex;
		}

		.nav-links a {
			padding: 0.6rem 0.7rem;
			border-radius: 0;
			border-top: 1px solid rgba(255,255,255,0.1);
		}
	}
</style>

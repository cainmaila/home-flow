import { test } from '@playwright/test';

const PAGES = [
	{ name: 'login', path: '/login', needsAuth: false },
	{ name: 'reports', path: '/reports', needsAuth: true },
	{ name: 'details', path: '/reports/details', needsAuth: true },
	{ name: 'import', path: '/import', needsAuth: true },
	{ name: 'corrections', path: '/corrections', needsAuth: true },
	{ name: 'history', path: '/import/history', needsAuth: true }
];

for (const pg of PAGES) {
	test(`visual: ${pg.name}`, async ({ page }) => {
		await page.goto(pg.path);
		await page.waitForLoadState('networkidle');

		await page.screenshot({
			path: `tests/e2e/screenshots/${pg.name}-desktop.png`,
			fullPage: true
		});

		await page.setViewportSize({ width: 375, height: 812 });
		await page.screenshot({
			path: `tests/e2e/screenshots/${pg.name}-mobile.png`,
			fullPage: true
		});
	});
}

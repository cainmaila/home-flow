import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

// Happy path: authed admin imports the sample CSV and sees it in the report.
test('import CSV then see totals in monthly report', async ({ page }) => {
	// Authenticated (forged cookie via global-setup) → home redirects to /reports.
	await page.goto('/reports');
	await expect(page.getByRole('heading', { name: '月報表' })).toBeVisible();

	// Import the sample CSV.
	await page.goto('/import');
	await page.locator('input#csv-file').setInputFiles(resolve('docs/費用.csv'));
	await page.locator('input#year').fill('2025');
	await page.getByRole('button', { name: '上傳並預覽' }).click();

	// Preview renders (parsing is server-side), then commit.
	await expect(page.getByRole('heading', { name: '預覽結果' })).toBeVisible({ timeout: 15_000 });
	await page.getByRole('button', { name: '確認匯入' }).click();

	// Commit summary appears.
	await expect(page.getByRole('heading', { name: '匯入完成' })).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('新增')).toBeVisible();

	// Report now has data (no empty-state message).
	await page.goto('/reports');
	await expect(page.getByText('尚無支出資料')).toHaveCount(0);
	await expect(page.getByText('總支出')).toBeVisible();
	await expect(page.getByRole('heading', { name: '分類排行' })).toBeVisible();
});

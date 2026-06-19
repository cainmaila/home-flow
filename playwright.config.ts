import { defineConfig } from '@playwright/test';

// Must match SESSION_SECRET in .dev.vars (the dev server reads it via the
// Cloudflare platform proxy). global-setup forges a session cookie with it.
export const SESSION_SECRET = 'e2e-test-session-secret-do-not-use-in-prod';
export const BASE_URL = 'http://localhost:5173';

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	timeout: 30_000,
	use: {
		baseURL: BASE_URL,
		storageState: 'tests/e2e/.auth/admin.json'
	},
	webServer: {
		command: 'npm run dev',
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 60_000
	}
});

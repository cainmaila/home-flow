import { writeFileSync, mkdirSync } from 'node:fs';
import { createSessionCookie } from '../../src/lib/server/auth/session';
import { SESSION_SECRET } from '../../playwright.config';

// Forge a valid admin session cookie so e2e can skip real Google OAuth.
// cainmaila@gmail.com is the seeded admin (src/lib/config/allowlist.ts).
export default async function globalSetup() {
	const value = await createSessionCookie(
		{ email: 'cainmaila@gmail.com', name: 'cainmaila', role: 'admin' },
		SESSION_SECRET
	);

	const storageState = {
		cookies: [
			{
				name: 'session',
				value,
				domain: 'localhost',
				path: '/',
				expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
				httpOnly: true,
				secure: true,
				sameSite: 'Lax' as const
			}
		],
		origins: []
	};

	mkdirSync('tests/e2e/.auth', { recursive: true });
	writeFileSync('tests/e2e/.auth/admin.json', JSON.stringify(storageState));
}

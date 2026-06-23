import { allowlist } from '$lib/server/auth/allowlist';

/**
 * Seed the default household and all allowlist users into D1.
 * Idempotent: safe to call on every app start or deploy.
 *
 * The first admin is bootstrapped by migrations/0002_seed.sql (via wrangler d1 migrations apply).
 * This function syncs all allowlist entries and can be called at app startup
 * to pick up newly added allowlist users without a new migration.
 */
export async function seed(db: D1Database): Promise<void> {
	await db
		.prepare(`INSERT OR IGNORE INTO households (id, name) VALUES (?, ?)`)
		.bind('default', 'Home')
		.run();

	for (const user of allowlist) {
		await db
			.prepare(
				`INSERT OR REPLACE INTO users (id, household_id, email, name, role) VALUES (?, 'default', ?, ?, ?)`
			)
			.bind(user.email, user.email, user.name, user.role)
			.run();
	}
}

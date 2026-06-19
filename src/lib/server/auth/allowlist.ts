import { allowlist } from '$lib/config/allowlist';

export function isAllowed(email: string): boolean {
	return allowlist.some((u) => u.email === email);
}

export function getRole(email: string): 'admin' | 'viewer' | null {
	const entry = allowlist.find((u) => u.email === email);
	return entry?.role ?? null;
}

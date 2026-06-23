export const allowlist = [
	{ email: 'cainmaila@gmail.com', name: 'cainmaila', role: 'admin' as const },
] as const;

export function isAllowed(email: string): boolean {
	return allowlist.some((u) => u.email === email);
}

export function getRole(email: string): 'admin' | 'viewer' | null {
	const entry = allowlist.find((u) => u.email === email);
	return entry?.role ?? null;
}

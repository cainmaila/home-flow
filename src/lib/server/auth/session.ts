const COOKIE_NAME = 'session';
const DEFAULT_MAX_AGE_DAYS = 7;

interface SessionPayload {
	email: string;
	name: string;
	role: 'admin' | 'viewer';
	exp: number;
}

export interface SessionUser {
	email: string;
	name: string;
	role: 'admin' | 'viewer';
}

function toBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
	const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function getHmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		[usage]
	);
}

async function hmacSign(data: string, secret: string): Promise<string> {
	const key = await getHmacKey(secret, 'sign');
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
	return toBase64Url(sig);
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
	const key = await getHmacKey(secret, 'verify');
	const sigBytes = fromBase64Url(signature);
	return crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, new TextEncoder().encode(data));
}

export async function createSessionCookie(
	user: SessionUser,
	secret: string,
	maxAgeDays = DEFAULT_MAX_AGE_DAYS
): Promise<string> {
	const payload: SessionPayload = {
		email: user.email,
		name: user.name,
		role: user.role,
		exp: Date.now() + maxAgeDays * 24 * 60 * 60 * 1000
	};
	const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)).buffer);
	const sig = await hmacSign(payloadB64, secret);
	return `${payloadB64}.${sig}`;
}

export async function parseSessionCookie(
	cookie: string,
	secret: string
): Promise<SessionUser | null> {
	const parts = cookie.split('.');
	if (parts.length !== 2) return null;
	const [payloadB64, sig] = parts;

	if (!(await hmacVerify(payloadB64, sig, secret))) return null;

	try {
		const json = new TextDecoder().decode(fromBase64Url(payloadB64));
		const payload: SessionPayload = JSON.parse(json);
		if (payload.exp < Date.now()) return null;
		return { email: payload.email, name: payload.name, role: payload.role };
	} catch {
		return null;
	}
}

export function sessionCookieHeader(
	value: string,
	maxAgeDays = DEFAULT_MAX_AGE_DAYS
): string {
	const maxAge = maxAgeDays * 24 * 60 * 60;
	return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
	return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export { COOKIE_NAME };

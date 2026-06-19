import { error, redirect, type Handle } from '@sveltejs/kit';
import { parseSessionCookie, COOKIE_NAME } from '$lib/server/auth/session';

const PUBLIC_PREFIXES = ['/auth/', '/session/', '/login'];
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isPublic(path: string): boolean {
	return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export const handle: Handle = async ({ event, resolve }) => {
	const secret = event.platform?.env?.SESSION_SECRET;
	const cookie = event.cookies.get(COOKIE_NAME);

	if (secret && cookie) {
		const user = await parseSessionCookie(cookie, secret);
		if (user) {
			event.locals.user = user;
		}
	}

	const { pathname } = event.url;

	// Public routes: skip all auth checks
	if (isPublic(pathname)) return resolve(event);

	const user = event.locals.user;

	// Mutation methods require admin
	if (MUTATION_METHODS.has(event.request.method)) {
		if (!user) throw error(401, 'Not authenticated');
		if (user.role !== 'admin') throw error(403, 'Admin access required');
		return resolve(event);
	}

	// GET requests to protected routes require authentication
	if (!user) {
		// API / fetch requests get JSON 401; page requests redirect to /login
		const accept = event.request.headers.get('accept') ?? '';
		if (pathname.startsWith('/api/') || accept.includes('application/json')) {
			throw error(401, 'Not authenticated');
		}
		throw redirect(303, '/login');
	}

	return resolve(event);
};

import type { RequestHandler } from './$types';
import { parseSessionCookie, COOKIE_NAME } from '$lib/server/auth/session';

export const GET: RequestHandler = async ({ cookies, platform }) => {
	const secret = platform?.env?.SESSION_SECRET;
	if (!secret) {
		return new Response('Missing SESSION_SECRET', { status: 500 });
	}

	const cookie = cookies.get(COOKIE_NAME);
	if (!cookie) {
		return Response.json({ error: 'unauthenticated' }, { status: 401 });
	}

	const user = await parseSessionCookie(cookie, secret);
	if (!user) {
		return Response.json({ error: 'unauthenticated' }, { status: 401 });
	}

	return Response.json({ email: user.email, name: user.name, role: user.role });
};

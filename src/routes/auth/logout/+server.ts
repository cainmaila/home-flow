import type { RequestHandler } from './$types';
import { clearSessionCookieHeader } from '$lib/server/auth/session';

export const POST: RequestHandler = async ({ url }) => {
	return new Response(null, {
		status: 302,
		headers: {
			Location: `${url.origin}/login`,
			'Set-Cookie': clearSessionCookieHeader()
		}
	});
};

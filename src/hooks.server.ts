import type { Handle } from '@sveltejs/kit';
import { parseSessionCookie, COOKIE_NAME } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	const secret = event.platform?.env?.SESSION_SECRET;
	const cookie = event.cookies.get(COOKIE_NAME);

	if (secret && cookie) {
		const user = await parseSessionCookie(cookie, secret);
		if (user) {
			event.locals.user = user;
		}
	}

	return resolve(event);
};

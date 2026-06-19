import type { RequestHandler } from './$types';
import { isAllowed, getRole } from '$lib/server/auth/allowlist';
import { seed } from '$lib/server/seed';
import {
	createSessionCookie,
	sessionCookieHeader
} from '$lib/server/auth/session';

export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const env = platform?.env;
	if (!env?.GOOGLE_CLIENT_ID || !env?.GOOGLE_CLIENT_SECRET || !env?.SESSION_SECRET) {
		return new Response('Missing environment variables', { status: 500 });
	}

	// Verify state
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');
	if (!state || state !== storedState) {
		return new Response('Invalid state', { status: 400 });
	}

	const code = url.searchParams.get('code');
	if (!code) {
		return new Response('Missing code', { status: 400 });
	}

	// Exchange code for tokens
	const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: `${url.origin}/auth/callback`,
			grant_type: 'authorization_code'
		})
	});

	if (!tokenRes.ok) {
		return Response.redirect(`${url.origin}/login?error=token_exchange_failed`, 302);
	}

	const tokens: { access_token: string } = await tokenRes.json();

	// Get user info
	const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
		headers: { Authorization: `Bearer ${tokens.access_token}` }
	});

	if (!userInfoRes.ok) {
		return Response.redirect(`${url.origin}/login?error=userinfo_failed`, 302);
	}

	const userInfo: { email: string; name: string } = await userInfoRes.json();

	// Allowlist check
	if (!isAllowed(userInfo.email)) {
		return Response.redirect(`${url.origin}/login?error=not_allowed`, 302);
	}

	const role = getRole(userInfo.email);
	if (!role) {
		return Response.redirect(`${url.origin}/login?error=not_allowed`, 302);
	}

	// Sync allowlist users to D1
	if (env.DB) {
		try {
			await seed(env.DB);
		} catch {
			return Response.redirect(`${url.origin}/login?error=seed_failed`, 302);
		}
	}

	// Create session cookie
	const maxAgeDays = Number(env.SESSION_MAX_AGE_DAYS) || 7;
	const cookieValue = await createSessionCookie(
		{ email: userInfo.email, name: userInfo.name, role },
		env.SESSION_SECRET,
		maxAgeDays
	);

	// Clear oauth_state cookie and set session cookie
	return new Response(null, {
		status: 302,
		headers: [
			['Location', `${url.origin}/`],
			['Set-Cookie', sessionCookieHeader(cookieValue, maxAgeDays)],
			['Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0']
		]
	});
};

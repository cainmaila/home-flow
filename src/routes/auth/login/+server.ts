import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, platform }) => {
	const env = platform?.env;
	if (!env?.GOOGLE_CLIENT_ID) {
		return new Response('Missing GOOGLE_CLIENT_ID', { status: 500 });
	}

	const state = crypto.randomUUID();
	const redirectUri = `${url.origin}/auth/callback`;

	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state
	});

	const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

	return new Response(null, {
		status: 302,
		headers: {
			Location: googleAuthUrl,
			'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
		}
	});
};

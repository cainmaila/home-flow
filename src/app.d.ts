/// <reference types="@cloudflare/workers-types" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: { email: string; name: string; role: 'admin' | 'viewer' };
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				SESSION_SECRET: string;
				SESSION_MAX_AGE_DAYS?: string;
				GOOGLE_AI_API_KEY?: string;
				AI_FEATURE_ENABLED?: string;
				AI_AUTO_ACCEPT_THRESHOLD?: string;
			};
		}
	}
}

export {};

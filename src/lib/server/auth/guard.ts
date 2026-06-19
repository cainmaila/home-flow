import { error } from '@sveltejs/kit';
import type { SessionUser } from './session';

type Locals = { user?: SessionUser };

/** Throws 401 if not authenticated. Returns the user on success. */
export function requireAuth(locals: Locals): SessionUser {
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

/** Throws 403 if user is not admin. Returns the user on success. */
export function requireAdmin(locals: Locals): SessionUser {
	const user = requireAuth(locals);
	if (user.role !== 'admin') throw error(403, 'Admin access required');
	return user;
}

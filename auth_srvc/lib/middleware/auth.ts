import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth-config';
import { UnauthorizedError } from '../utils/api-response';

export async function requireAuth() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		throw new UnauthorizedError();
	}

	return session;
}

export async function requireAuthWithUserId() {
	const session = await requireAuth();

	const userId = parseInt(session.user.id);
	if (isNaN(userId)) {
		throw new Error('Invalid user ID in session');
	}

	return { session, userId };
}

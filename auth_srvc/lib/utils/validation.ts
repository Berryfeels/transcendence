/**
 * Validates and parses a user ID from string or number format
 * @throws {Error} If userId is missing or invalid
 */
export function validateAndParseUserId(userId: string | number): number {
	if (!userId) {
		throw new Error('User ID is required');
	}

	const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;

	if (Number.isNaN(id)) {
		throw new Error('Invalid user ID');
	}

	return id;
}

/**
 * Validates and parses a friendship ID from string format
 * @throws {Error} If friendshipId is invalid
 */
export function validateFriendshipId(id: string): number {
	const friendshipId = parseInt(id);
	if (isNaN(friendshipId)) {
		throw new Error('Invalid friendship ID');
	}
	return friendshipId;
}

/**
 * Validates an addressee ID from request body
 * @throws {Error} If addresseeId is missing or invalid type
 */
export function validateAddresseeId(addresseeId: unknown): number {
	if (!addresseeId) {
		throw new Error('addresseeId is required');
	}

	if (typeof addresseeId !== 'number') {
		throw new Error('addresseeId must be a number');
	}

	return addresseeId;
}

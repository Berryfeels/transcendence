import { prisma } from "../prisma/prisma";
import { FriendshipStatus } from '@prisma/client';

export interface FriendRequest {
	id: number;
	requesterId: number;
	addresseeId: number;
	status: FriendshipStatus;
	createdAt: Date;
	updatedAt: Date;
}

export interface FriendRequestResult {
	success: boolean;
	message: string;
	data?: FriendRequest;
	error?: string;
}

export async function sendFriendRequest(
	requesterId: number,
	addresseeId: number
): Promise<FriendRequestResult> {
	try {
		if (requesterId === addresseeId) {
			return {
				success: false,
				message: 'Cannot send friend request to yourself',
				error: 'INVALID_SELF_REQUEST'
			};
		}

		const [requester, addressee] = await Promise.all([
			prisma.user.findUnique({ where: { id: requesterId } }),
			prisma.user.findUnique({ where: { id: addresseeId } })
		]);

		if (!requester || !requester.isActive) {
			return {
				success: false,
				message: 'Requester not found or inactive',
				error: 'REQUESTER_NOT_FOUND'
			};
		}

		if (!addressee || !addressee.isActive) {
			return {
				success: false,
				message: 'User not found or inactive',
				error: 'ADDRESSEE_NOT_FOUND'
			};
		}

		const existingRelationship = await prisma.friendship.findFirst({
			where: {
				OR: [
					{ requesterId, addresseeId },
					{ requesterId: addresseeId, addresseeId: requesterId }
				]
			}
		});

		if (existingRelationship) {
			if (existingRelationship.status === FriendshipStatus.BLOCKED) {
				return {
					success: false,
					message: 'Cannot send friend request due to blocked relationship',
					error: 'RELATIONSHIP_BLOCKED'
				};
			}

			if (existingRelationship.status === FriendshipStatus.PENDING) {
				if (existingRelationship.requesterId === addresseeId) {
					const accepted = await prisma.friendship.update({
						where: { id: existingRelationship.id },
						data: { status: FriendshipStatus.ACCEPTED }
					});

					return {
						success: true,
						message: 'Friend request accepted (mutual request)',
						data: accepted
					};
				}

				return {
					success: false,
					message: 'Friend request already pending',
					error: 'REQUEST_ALREADY_PENDING'
				};
			}

			if (existingRelationship.status === FriendshipStatus.ACCEPTED) {
				return {
					success: false,
					message: 'Already friends',
					error: 'ALREADY_FRIENDS'
				};
			}

			if (existingRelationship.status === FriendshipStatus.REJECTED) {
				const updated = await prisma.friendship.update({
					where: { id: existingRelationship.id },
					data: {
						requesterId,
						addresseeId,
						status: FriendshipStatus.PENDING,
						updatedAt: new Date()
					}
				});

				return {
					success: true,
					message: 'Friend request sent',
					data: updated
				};
			}
		}

		const friendRequest = await prisma.friendship.create({
			data: {
				requesterId,
				addresseeId,
				status: FriendshipStatus.PENDING
			}
		});

		return {
			success: true,
			message: 'Friend request sent successfully',
			data: friendRequest
		};
	} catch (error) {
		console.error('Error sending friend request:', error);
		return {
			success: false,
			message: 'Failed to send friend request',
			error: 'INTERNAL_ERROR'
		};
	}
}

export async function getPendingRequests(userId: number) {
	try {
		const requests = await prisma.friendship.findMany({
			where: {
				addresseeId: userId,
				status: FriendshipStatus.PENDING
			},
			include: {
				requester: {
					select: {
						id: true,
						username: true,
						email: true
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		return {
			success: true,
			data: requests
		};
	} catch (error) {
		console.error('Error getting pending requests:', error);
		return {
			success: false,
			message: 'Failed to get pending requests',
			error: 'INTERNAL_ERROR'
		};
	}
}

export async function getFriends(userId: number) {
	try {
		const friendships = await prisma.friendship.findMany({
			where: {
				OR: [
					{ requesterId: userId },
					{ addresseeId: userId }
				],
				status: FriendshipStatus.ACCEPTED
			},
			include: {
				requester: {
					select: {
						id: true,
						username: true,
						email: true,
						wins: true,
						losses: true,
						draws: true,
						points: true
					}
				},
				addressee: {
					select: {
						id: true,
						username: true,
						email: true,
						wins: true,
						losses: true,
						draws: true,
						points: true
					}
				}
			}
		});

		const friends = friendships.map(friendship => {
			return friendship.requesterId === userId
				? friendship.addressee
				: friendship.requester;
		});

		return {
			success: true,
			data: friends
		};
	} catch (error) {
		console.error('Error getting friends:', error);
		return {
			success: false,
			message: 'Failed to get friends',
			error: 'INTERNAL_ERROR'
		};
	}
}

export async function acceptFriendRequest(
	friendshipId: number,
	userId: number
): Promise<FriendRequestResult> {
	try {
		const friendship = await prisma.friendship.findUnique({
			where: { id: friendshipId }
		});

		if (!friendship) {
			return {
				success: false,
				message: 'Friend request not found',
				error: 'REQUEST_NOT_FOUND'
			};
		}

		if (friendship.addresseeId !== userId) {
			return {
				success: false,
				message: 'You are not authorized to accept this request',
				error: 'UNAUTHORIZED'
			};
		}

		if (friendship.status !== FriendshipStatus.PENDING) {
			return {
				success: false,
				message: `Cannot accept request with status: ${friendship.status}`,
				error: 'INVALID_STATUS'
			};
		}

		const updated = await prisma.friendship.update({
			where: { id: friendshipId },
			data: { status: FriendshipStatus.ACCEPTED }
		});

		return {
			success: true,
			message: 'Friend request accepted',
			data: updated
		};
	} catch (error) {
		console.error('Error accepting friend request:', error);
		return {
			success: false,
			message: 'Failed to accept friend request',
			error: 'INTERNAL_ERROR'
		};
	}
}

export async function rejectFriendRequest(
	friendshipId: number,
	userId: number
): Promise<FriendRequestResult> {
	try {
		const friendship = await prisma.friendship.findUnique({
			where: { id: friendshipId }
		});

		if (!friendship) {
			return {
				success: false,
				message: 'Friend request not found',
				error: 'REQUEST_NOT_FOUND'
			};
		}

		if (friendship.addresseeId !== userId) {
			return {
				success: false,
				message: 'You are not authorized to reject this request',
				error: 'UNAUTHORIZED'
			};
		}

		if (friendship.status !== FriendshipStatus.PENDING) {
			return {
				success: false,
				message: `Cannot reject request with status: ${friendship.status}`,
				error: 'INVALID_STATUS'
			};
		}

		await prisma.friendship.delete({
			where: { id: friendshipId }
		});

		return {
			success: true,
			message: 'Friend request rejected'
		};
	} catch (error) {
		console.error('Error rejecting friend request:', error);
		return {
			success: false,
			message: 'Failed to reject friend request',
			error: 'INTERNAL_ERROR'
		};
	}
}

export async function removeFriendship(
	userId: number,
	friendId: number
): Promise<FriendRequestResult> {
	try {
		const friendship = await prisma.friendship.findFirst({
			where: {
				OR: [
					{ requesterId: userId, addresseeId: friendId },
					{ requesterId: friendId, addresseeId: userId }
				],
				status: FriendshipStatus.ACCEPTED
			}
		});

		if (!friendship) {
			return {
				success: false,
				message: 'Friendship not found',
				error: 'FRIENDSHIP_NOT_FOUND'
			};
		}

		await prisma.friendship.delete({
			where: { id: friendship.id }
		});

		return {
			success: true,
			message: 'Friendship removed successfully'
		};
	} catch (error) {
		console.error('Error removing friendship:', error);
		return {
			success: false,
			message: 'Failed to remove friendship',
			error: 'INTERNAL_ERROR'
		};
	}
}
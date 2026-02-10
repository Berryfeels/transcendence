import { NextRequest, NextResponse } from 'next/server';
import { sendFriendRequest } from '@/lib/friend';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { requesterId, addresseeId } = body;

		if (!requesterId || !addresseeId) {
			return NextResponse.json(
				{
					success: false,
					message: 'Both requesterId and addresseeId are required'
				},
				{ status: 400 }
			);
		}

		if (typeof requesterId !== 'number' || typeof addresseeId !== 'number') {
			return NextResponse.json(
				{
					success: false,
					message: 'requesterId and addresseeId must be numbers'
				},
				{ status: 400 }
			);
		}

		const result = await sendFriendRequest(requesterId, addresseeId);

		if (!result.success) {
			const statusCodeMap: Record<string, number> = {
				INVALID_SELF_REQUEST: 400,
				REQUESTER_NOT_FOUND: 404,
				ADDRESSEE_NOT_FOUND: 404,
				RELATIONSHIP_BLOCKED: 403,
				REQUEST_ALREADY_PENDING: 409,
				ALREADY_FRIENDS: 409,
				INTERNAL_ERROR: 500
			};

			const statusCode = result.error ? statusCodeMap[result.error] || 400 : 400;

			return NextResponse.json(
				{
					success: false,
					message: result.message,
					error: result.error
				},
				{ status: statusCode }
			);
		}

		return NextResponse.json(
			{
				success: true,
				message: result.message,
				data: result.data
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error in friend request route:', error);
		return NextResponse.json(
			{
				success: false,
				message: 'Internal server error',
				error: 'INTERNAL_ERROR'
			},
			{ status: 500 }
		);
	}
}
import { NextRequest, NextResponse } from 'next/server';
import { rejectFriendRequest } from '@/lib/friend';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { friendshipId, userId } = body;

		if (!friendshipId || !userId) {
			return NextResponse.json(
				{
					success: false,
					message: 'Both friendshipId and userId are required'
				},
				{ status: 400 }
			);
		}

		if (typeof friendshipId !== 'number' || typeof userId !== 'number') {
			return NextResponse.json(
				{
					success: false,
					message: 'friendshipId and userId must be numbers'
				},
				{ status: 400 }
			);
		}

		const result = await rejectFriendRequest(friendshipId, userId);

		if (!result.success) {
			const statusCodeMap: Record<string, number> = {
				REQUEST_NOT_FOUND: 404,
				UNAUTHORIZED: 403,
				INVALID_STATUS: 400,
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
			{ status: 200 }
		);
	} catch (error) {
		console.error('Error in reject friend request route:', error);
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
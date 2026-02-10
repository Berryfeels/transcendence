import { NextRequest, NextResponse } from 'next/server';
import { removeFriendship } from '@/lib/friend';

export async function DELETE(req: NextRequest) {
	try {
		const body = await req.json();
		const { userId, friendId } = body;

		if (!userId || !friendId) {
			return NextResponse.json(
				{
					success: false,
					message: 'Both userId and friendId are required'
				},
				{ status: 400 }
			);
		}

		if (typeof userId !== 'number' || typeof friendId !== 'number') {
			return NextResponse.json(
				{
					success: false,
					message: 'userId and friendId must be numbers'
				},
				{ status: 400 }
			);
		}

		if (userId === friendId) {
			return NextResponse.json(
				{
					success: false,
					message: 'Cannot unfriend yourself'
				},
				{ status: 400 }
			);
		}

		const result = await removeFriendship(userId, friendId);

		if (!result.success) {
			const statusCodeMap: Record<string, number> = {
				FRIENDSHIP_NOT_FOUND: 404,
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
				message: result.message
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Error in remove friendship route:', error);
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
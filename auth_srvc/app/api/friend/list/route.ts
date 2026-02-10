import { NextRequest, NextResponse } from 'next/server';
import { getFriends } from '@/lib/friend';

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const userIdParam = searchParams.get('userId');

		if (!userIdParam) {
			return NextResponse.json(
				{
					success: false,
					message: 'userId query parameter is required'
				},
				{ status: 400 }
			);
		}

		const userId = parseInt(userIdParam, 10);

		if (isNaN(userId)) {
			return NextResponse.json(
				{
					success: false,
					message: 'userId must be a valid number'
				},
				{ status: 400 }
			);
		}

		const result = await getFriends(userId);

		if (!result.success) {
			return NextResponse.json(
				{
					success: false,
					message: result.message,
					error: result.error
				},
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			data: result.data
		});
	} catch (error) {
		console.error('Error in friends list route:', error);
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
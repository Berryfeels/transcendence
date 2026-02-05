import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../lib/auth"
import { getUserById } from "../../../lib/profile"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions)
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
		}

		const { searchParams } = new URL(req.url)
		const userId = searchParams.get('userId') || session.user.id

		const user = await getUserById(userId)
		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 })
		}

		return NextResponse.json(user)
	} catch (err: any) {
		console.error(err)
		return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
	}
}
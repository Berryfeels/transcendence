import { NextResponse } from "next/server"
import { registerUser } from "../../../lib/register"

export async function POST(req: Request) {
	try {
		const data = await req.json()
		await registerUser(data)
		return NextResponse.json({ success: true })
	} catch (err) {
		return NextResponse.json(
			{ error: (err as Error).message },
			{ status: 400 }
		)
	}
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
	if (request.method === 'OPTIONS') {
		return new NextResponse(null, { status: 204 })
	}
	const response = NextResponse.next()

	const origin = process.env.CORS_ALLOWED_ORIGIN || 'http://localhost:3003'
	response.headers.set('Access-Control-Allow-Origin', origin)
	response.headers.set('Access-Control-Allow-Credentials', 'true')
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

	return response
}

export const config = {
	matcher: '/api/:path*',
}
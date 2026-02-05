import { prisma } from "../prisma/prisma";

export async function getUserById(userId: string | number) {
	if (!userId) throw new Error("User ID is required")


	const id = typeof userId === "string" ? parseInt(userId) : userId


	const user = await prisma.user.findUnique({
		where: { id },
		select: { username: true, email: true },
	})


	return user
}

export async function updateUserProfile(userId: string | number, data: { username: string; email: string }) {
	if (!userId) throw new Error("User ID is required")
	if (!data.username || !data.email) throw new Error("Username and email are required")


	const updatedUser = await prisma.user.update({
		where: { id: typeof userId === "string" ? parseInt(userId) : userId },
		data: { username: data.username, email: data.email },
	})


	return updatedUser
}

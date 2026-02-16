import { prisma } from "../prisma/prisma";
import { validateAndParseUserId } from "./utils/validation";

export async function getUserById(userId: string | number) {
	const id = validateAndParseUserId(userId);

	const user = await prisma.user.findUnique({
		where: { id },
		select: { username: true, wins: true, losses: true },
	})

	return user
}

export async function getUserByUsername(username: string) {
	if (!username) throw new Error("Username is required")

	const user = await prisma.user.findUnique({
		where: { username },
		select: {
			id: true,
			username: true,
			email: true,
			isActive: true
		},
	})

	if (!user || !user.isActive) {
		return null
	}

	return user
}

export async function updateUserProfile(userId: string | number, data: { username: string; email: string }) {
	if (!data.username || !data.email) {
		throw new Error("Username and email are required");
	}

	const id = validateAndParseUserId(userId);

	const updatedUser = await prisma.user.update({
		where: { id },
		data: { username: data.username, email: data.email },
	})

	return updatedUser
}

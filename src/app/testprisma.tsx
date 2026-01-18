// NOTE: Adjust this import path based on your 'output' config in schema.prisma
// If you remove the 'output' line in schema, use: import { PrismaClient } from '@prisma/client'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import * as readline from 'readline'
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL || ''
})
// const pisma = new PrismaClient() expects now a configuration object in Prisma 7
// Prisma now integrates with Prisma Accelerate, which is Prisma's global caching layer + connection pooling service

// Setup interface to read from the command line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Helper function to ask questions
const ask = (query: string) => new Promise<string>((resolve) => rl.question(query, resolve))

async function main() {
  console.log("--- Create a New User ---")

  try {
    // 1. Get Input
    const name = await ask("Enter user name: ")
    const email = await ask("Enter user email: ")
    const ageInput = await ask("Enter user age: ")
    const bigNumInput = await ask("Enter a really large number: ")

    // 2. Write to Database
    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        age: parseInt(ageInput) || null, // Handle optional integer
        largeNumber: BigInt(bigNumInput), // Handle BigInt conversion
        role: "BASIC", // Defaulting to the enum
        // We can skip 'isAdmin' and 'data' because they have default values in your schema
      },
    })

    console.log(`\nSuccess! User created with ID: ${newUser.id}`)
    console.log(newUser)

  } catch (error) {
    console.error("Error creating user:", error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()
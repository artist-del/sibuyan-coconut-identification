"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function registerUser(input: unknown) {
  const data = registerSchema.parse(input);
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() }
  });

  if (existing) {
    return { ok: false, message: "An account with this email already exists." };
  }

  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      password: await bcrypt.hash(data.password, 12)
    }
  });

  return { ok: true, message: "Account created. You can now sign in." };
}

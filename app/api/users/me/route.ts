import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateUserSchema = z.object({
    name: z.string().min(2, "Full name is required"),
    email: z.string().email("Please provide a valid email address")
});

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
    }

    try {
        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: { name: parsed.data.name, email: parsed.data.email.toLowerCase() }
        });

        return NextResponse.json({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
        return NextResponse.json({ message: "Email is already in use" }, { status: 409 });
    }
}

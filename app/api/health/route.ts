import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    nextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
    nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET)
  };

  try {
    await prisma.user.count();

    return NextResponse.json({
      ok: true,
      env,
      database: "connected"
    });
  } catch (error) {
    console.error("Health check database error", error);

    return NextResponse.json(
      {
        ok: false,
        env,
        database: "error"
      },
      { status: 500 }
    );
  }
}

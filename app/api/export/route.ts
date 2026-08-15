import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { varietiesToCsv, varietiesToPdf } from "@/services/export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const varieties = await prisma.coconutVariety.findMany({
    orderBy: { name: "asc" },
    select: { name: true, localName: true, locationFound: true, fruitColor: true, averageYield: true, imageUrl: true }
  });

  if (format === "pdf") {
    return new NextResponse(await varietiesToPdf(varieties), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=Cajidiocan-coconut-records.pdf"
      }
    });
  }

  return new NextResponse(varietiesToCsv(varieties), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=Cajidiocan-coconut-records.csv"
    }
  });
}

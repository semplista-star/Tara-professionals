import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const meeting = await prisma.meeting.findFirst({
    where: {
      startsAt: { gt: new Date() },
      participants: { some: { id: (session.user as any).id } }
    },
    include: {
      creator: { select: { id: true, name: true, color: true } },
      participants: { select: { id: true, name: true, color: true } }
    },
    orderBy: { startsAt: "asc" }
  });

  return NextResponse.json(meeting);
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting || meeting.creatorId !== (session.user as any).id) {
    return NextResponse.json({ error: "No trobat" }, { status: 404 });
  }

  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

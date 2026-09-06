import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const file = await prisma.personalFile.findUnique({ where: { id } });
  if (!file || file.ownerId !== (session.user as any).id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.personalFile.delete({ where: { id } });
  await del(file.url).catch(() => {});

  return NextResponse.json({ ok: true });
}

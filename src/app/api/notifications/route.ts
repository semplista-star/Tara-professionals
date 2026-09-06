import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = (session.user as any).id;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.notification.count({ where: { userId, read: false } })
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (body.action !== "read-all") {
    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: (session.user as any).id, read: false },
    data: { read: true }
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_MS = 45_000;
const TYPING_MS = 6_000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.presence.findMany();
  const now = Date.now();
  const result = rows.map((r) => ({
    userId: r.userId,
    online: now - r.lastSeenAt.getTime() < ONLINE_MS,
    typing: !!r.typingAt && now - r.typingAt.getTime() < TYPING_MS
  }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const userId = (session.user as any).id;
  const now = new Date();

  await prisma.presence.upsert({
    where: { userId },
    update: { lastSeenAt: now, ...(body.typing ? { typingAt: now } : {}) },
    create: { userId, lastSeenAt: now, typingAt: body.typing ? now : null }
  });

  return NextResponse.json({ ok: true });
}

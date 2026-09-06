import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const body = await req.json();
  const { endpoint, keys } = body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Subscripció invàlida" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: (session.user as any).id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: (session.user as any).id }
  });

  return NextResponse.json({ ok: true });
}

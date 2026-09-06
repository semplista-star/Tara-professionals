import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "Falta l'endpoint" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: (session.user as any).id }
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after");

  const messages = await prisma.message.findMany({
    where: after ? { createdAt: { gt: new Date(after) } } : undefined,
    include: { author: { select: { id: true, name: true, color: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
    take: after ? undefined : 100 // càrrega inicial: últims 100 missatges
  });

  return NextResponse.json(messages);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.text && !body.attachmentUrl) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      text: body.text?.trim() || null,
      attachmentUrl: body.attachmentUrl || null,
      attachmentType: body.attachmentType || null,
      attachmentName: body.attachmentName || null,
      authorId: (session.user as any).id
    },
    include: { author: { select: { id: true, name: true, color: true, avatarUrl: true } } }
  });

  const others = await prisma.user.findMany({
    where: { id: { not: message.authorId } },
    select: { id: true }
  });
  sendPushToUsers(others.map((u) => u.id), {
    title: `${message.author.name} en el chat`,
    body: message.text || "Ha enviado un archivo adjunto",
    url: "/dashboard/chat"
  }).catch(() => {});

  return NextResponse.json(message, { status: 201 });
}

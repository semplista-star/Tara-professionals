import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const kudos = await prisma.kudo.findMany({
    include: {
      giver: { select: { id: true, name: true, color: true } },
      receiver: { select: { id: true, name: true, color: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return NextResponse.json(kudos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const body = await req.json();
  if (!body.text || typeof body.text !== "string" || !body.receiverId) {
    return NextResponse.json({ error: "Falta el text o la persona" }, { status: 400 });
  }

  const giverId = (session.user as any).id;
  const kudo = await prisma.kudo.create({
    data: {
      text: body.text.trim(),
      giverId,
      receiverId: body.receiverId
    },
    include: {
      giver: { select: { id: true, name: true, color: true } },
      receiver: { select: { id: true, name: true, color: true } }
    }
  });

  if (kudo.receiverId !== giverId) {
    sendPushToUsers([kudo.receiverId], {
      title: "T'han reconegut 🌱",
      body: `${kudo.giver.name}: ${kudo.text}`,
      url: "/dashboard/kudos"
    }).catch(() => {});
  }

  return NextResponse.json(kudo, { status: 201 });
}

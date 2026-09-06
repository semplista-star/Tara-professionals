import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "Comentari buit" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      text: body.text.trim(),
      taskId: id,
      authorId: (session.user as any).id
    },
    include: { author: { select: { id: true, name: true, color: true } } }
  });

  return NextResponse.json(comment, { status: 201 });
}

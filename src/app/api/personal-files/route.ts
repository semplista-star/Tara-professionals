import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const files = await prisma.personalFile.findMany({
    where: { ownerId: (session.user as any).id },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(files);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.url || !body.name || !body.mimeType) {
    return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 });
  }

  const file = await prisma.personalFile.create({
    data: {
      name: body.name,
      url: body.url,
      mimeType: body.mimeType,
      ownerId: (session.user as any).id
    }
  });
  return NextResponse.json(file, { status: 201 });
}

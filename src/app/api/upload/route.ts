import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB per fitxer

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Falta el fitxer" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El fitxer supera els 20MB" }, { status: 413 });
  }

  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const blob = await put(safeName, file, { access: "public" });

  return NextResponse.json({ url: blob.url, name: file.name, type: file.type });
}

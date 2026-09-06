import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "archivo";
  if (!url) return NextResponse.json({ error: "Falta la URL" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!target.hostname.endsWith(".public.blob.vercel-storage.com")) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 400 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "No se ha podido descargar el archivo" }, { status: 502 });
  }

  const safeName = name.replace(/[\r\n"]/g, "_");
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`
    }
  });
}

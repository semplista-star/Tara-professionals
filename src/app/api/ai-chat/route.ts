import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { TARA_SYSTEM_PROMPT } from "@/lib/tara-system-prompt";
import { TEAM_ASSISTANT_SYSTEM_PROMPT } from "@/lib/team-assistant-system-prompt";

const MODEL = "claude-sonnet-4-6";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const mode = body.mode === "team" ? "team" : "tara";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "Falta la conversación" }, { status: 400 });
  }

  const systemPrompt = mode === "team" ? TEAM_ASSISTANT_SYSTEM_PROMPT : TARA_SYSTEM_PROMPT;
  if (!systemPrompt) {
    return NextResponse.json(
      { error: "El prompt de Tara todavía no está configurado en el servidor." },
      { status: 503 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "El asistente no está disponible en este momento. Próximamente." },
      { status: 503 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      }))
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ text: textBlock?.type === "text" ? textBlock.text : "" });
  } catch (err) {
    console.error("ai-chat error", err);
    return NextResponse.json({ error: "No se ha podido contactar con el asistente." }, { status: 502 });
  }
}

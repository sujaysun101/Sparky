import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { capMaxTokens, formatZodError, guardDemoRequest, MAX_OUTPUT_TOKENS } from "@/lib/demo-guard";
import { CODE_MAX, LEVELS, LANGUAGES, QUESTION_MAX } from "@/lib/tutor-limits";

const tutorResponseJsonSchema = {
  type: "object",
  properties: {
    explanation: { type: "string", description: "Clear, friendly explanation with analogies" },
    codeExample: { type: "string", description: "Working code example if helpful (as a string)" },
    commonMistakes: { type: "array", items: { type: "string" } },
    nextTopicsToLearn: { type: "array", items: { type: "string" } },
    encouragement: { type: "string", description: "Motivational message" },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    concepts: { type: "array", items: { type: "string" } },
  },
  required: [
    "explanation",
    "codeExample",
    "commonMistakes",
    "nextTopicsToLearn",
    "encouragement",
    "difficulty",
    "concepts",
  ],
};

const bodySchema = z
  .object({
    question: z.string().trim().min(1).max(QUESTION_MAX),
    code: z.string().max(CODE_MAX).optional().default(""),
    language: z.enum(LANGUAGES).optional().default("JavaScript"),
    level: z.enum(LEVELS).optional().default("beginner"),
  })
  .strict();

export async function POST(req: NextRequest) {
  const blocked = await guardDemoRequest(req);
  if (blocked) return blocked;

  let json: unknown;
  try {
    const raw = await req.text();
    if (raw.length > QUESTION_MAX + CODE_MAX + 1_000) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 400 });
    }
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { question, code, language, level } = parsed.data;
  const codeContext = code ? `\n\nStudent's code:\n\`\`\`${language}\n${code}\n\`\`\`` : "";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const client = new GoogleGenAI({ apiKey });
  let outputText: string | null = null;
  try {
    const interaction = await client.interactions.create({
      model: "gemini-4-hydrogen",
      input: `You are a patient, encouraging coding tutor for bootcamp students. The student is at a ${level} level learning ${language}.${codeContext}

Student question: ${question}

Provide a Socratic, guided explanation. Don't just give the answer — help them understand the concept.`,
      generation_config: {
        max_output_tokens: capMaxTokens(MAX_OUTPUT_TOKENS),
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: tutorResponseJsonSchema,
      },
    });
    outputText = interaction.output_text ?? null;
  } catch {
    // Do not log this error. Provider failures can echo request metadata.
    return NextResponse.json({ error: "The tutoring request could not be completed" }, { status: 502 });
  }

  if (!outputText) {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const text = outputText.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return NextResponse.json(JSON.parse(jsonMatch[0]));
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}

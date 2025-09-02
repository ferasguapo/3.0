import { NextRequest, NextResponse } from "next/server";
import {
  callAI,
  coerceToJSONObject,
  normalizeToSchema,
  NormalizedData,
} from "@/lib/ai";
import { scrapeOreilly, scrapeYoutube } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow long Groq generations on Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { year, make, model, part, code, notes } = body as {
      year?: string;
      make?: string;
      model?: string;
      part?: string;
      code?: string;
      notes?: string;
    };

    // Build a natural-language user prompt with vehicle details
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // ✅ Call Groq AI (system prompt handled inside callAI)
    const aiText = await callAI(userPrompt);

    // Parse and normalize AI output
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // Scrape Oreilly + YouTube links in parallel
    const [oreillyLinks, youtubeLinks] = await Promise.all([
      part
        ? scrapeOreilly(`${year ?? ""} ${make ?? ""} ${model ?? ""} ${part}`)
        : [],
      part
        ? scrapeYoutube(
            `${year ?? ""} ${make ?? ""} ${model ?? ""} ${part} repair tutorial`
          )
        : [],
    ]);

    const finalData: any = {
      overview: normalized.overview || "No overview available",
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: normalized.time_estimate || "N/A",
      cost_estimate: normalized.cost_estimate || "N/A",
      parts: [...(normalized.parts ?? []), ...oreillyLinks],
      videos: [...(normalized.videos ?? []), ...youtubeLinks],
  recommended_repairs: normalized.recommended_repairs ?? [],
};

    return NextResponse.json({ ok: true, data: finalData, raw: aiText }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

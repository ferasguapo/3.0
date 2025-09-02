import { NextRequest, NextResponse } from "next/server";
import {
  callAI,
  coerceToJSONObject,
  normalizeToSchema,
  NormalizedData,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    // Build a natural-language prompt for AI
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    // Call AI for diagnostics & repair instructions only
    const aiText = await callAI(userPrompt);

    // Parse and normalize AI output
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // Generate YouTube search links manually
    const searchQuery = encodeURIComponent(
      `${year ?? ""} ${make ?? ""} ${model ?? ""} ${part ?? ""} repair tutorial`
    );
    const youtubeLinks = [
      `https://www.youtube.com/results?search_query=${searchQuery}`,
      `https://www.youtube.com/results?search_query=${searchQuery}&sp=EgIQAQ%253D%253D`,
      `https://www.youtube.com/results?search_query=${searchQuery}&sp=CAMSAhAB`,
    ];

    // Generate O'Reilly parts search links manually
    const partsQuery = encodeURIComponent(
      `${year ?? ""} ${make ?? ""} ${model ?? ""} ${part ?? ""}`
    );
    const partsLinks = [
      `https://www.oreillyauto.com/search?query=${partsQuery}`,
      `https://www.oreillyauto.com/search?query=${partsQuery}&searchType=products`,
      `https://www.oreillyauto.com/search?query=${partsQuery}&searchType=all`,
    ];

    // Build final data object
    const finalData: any = {
      overview: normalized.overview || "No overview available",
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: normalized.time_estimate || "N/A",
      cost_estimate: normalized.cost_estimate || "N/A",
      parts: partsLinks,      // ONLY generated links
      videos: youtubeLinks,   // ONLY generated links
    };

    return NextResponse.json({ ok: true, data: finalData, raw: aiText }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

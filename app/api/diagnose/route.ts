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

    // Build AI prompt for diagnostics & repair instructions
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const aiText = await callAI(userPrompt);
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // --- Generate targeted YouTube search links ---
    const queries: string[] = [];

    // If OBD-II code is provided, always search "how to fix [code]" with optional vehicle info
    if (code) {
      let q = `how to fix ${code}`;
      if (year || make || model) {
        q += ` ${[year, make, model].filter(Boolean).join(" ")}`;
      }
      queries.push(q);
    }

    // If part is provided, include part + vehicle info
    if (part) {
      queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
    }

    // General fallback repair search
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    if (generalQuery) queries.push(`${generalQuery} repair`);

    // Deduplicate and encode queries for YouTube
    const uniqueQueries = Array.from(new Set(queries));
    const youtubeLinks = uniqueQueries.map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Keep O'Reilly parts links empty for now (update later) ---
    const partsLinks: string[] = [];

    // --- Build final data object ---
    const finalData: any = {
      overview: normalized.overview || "No overview available",
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: normalized.time_estimate || "N/A",
      cost_estimate: normalized.cost_estimate || "N/A",
      parts: partsLinks,      // Placeholder
      videos: youtubeLinks,   // Targeted YouTube searches
    };

    return NextResponse.json({ ok: true, data: finalData, raw: aiText }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

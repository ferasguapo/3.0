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

    // --- AI prompt for diagnostics & repair ---
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const aiText = await callAI(userPrompt);
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // --- YouTube links ---
    const queries: string[] = [];
    if (code) queries.push(`how to repair diagnose ${code}`);
    if (part) queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    if (generalQuery) queries.push(`${generalQuery} repair`);

    const youtubeLinks = Array.from(new Set(queries)).slice(0, 3).map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Parts links (O'Reilly, AutoZone, Advanced Auto Parts) ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the top 3 most likely parts/components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list, prioritize common parts.`;
      const partsText = await callAI(partsPrompt);

      aiParts = partsText
        .split(/,|\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.startsWith("{") && !p.startsWith("[") && !p.toLowerCase().includes("overview"))
        .slice(0, 3);
    }

    if (part && !aiParts.includes(part)) aiParts.unshift(part);
    aiParts = aiParts.slice(0, 3);

    // Generate one link per store
    const topPartsLinks: string[] = [];
    if (aiParts.length > 0) {
      const partQuery = [year, make, model, aiParts[0]].filter(Boolean).join(" ") || aiParts[0];
      topPartsLinks.push(`https://www.oreillyauto.com/search?query=${encodeURIComponent(partQuery)}`);

      if (aiParts[1]) {
        const partQuery2 = [year, make, model, aiParts[1]].filter(Boolean).join(" ") || aiParts[1];
        topPartsLinks.push(`https://www.autozone.com/searchresult?searchText=${encodeURIComponent(partQuery2)}`);
      }

      if (aiParts[2]) {
        const partQuery3 = [year, make, model, aiParts[2]].filter(Boolean).join(" ") || aiParts[2];
        topPartsLinks.push(`https://shop.advanceautoparts.com/search?searchText=${encodeURIComponent(partQuery3)}`);
      }
    }

    // --- Build final response ---
    const finalData: any = {
      overview: normalized.overview || "No overview available",
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: normalized.time_estimate || "N/A",
      cost_estimate: normalized.cost_estimate || "N/A",
      parts: topPartsLinks,
      videos: youtubeLinks,
    };

    return NextResponse.json({ ok: true, data: finalData, raw: aiText }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

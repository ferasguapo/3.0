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

    // --- AI prompt for diagnostics & repair instructions ---
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const aiText = await callAI(userPrompt);
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // --- YouTube queries ---
    const queries: string[] = [];
    if (code) queries.push(`how to repair diagnose ${code}`);
    if (part) queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    if (generalQuery) queries.push(`${generalQuery} repair`);

    const uniqueQueries = Array.from(new Set(queries));
    const youtubeLinks = uniqueQueries.slice(0, 3).map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Parts links (Amazon & eBay) with top 3 relevant results ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the top 3 most likely parts or components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list of parts, prioritizing the most common ones.`;
      const partsText = await callAI(partsPrompt);
      aiParts = partsText.split(/,|\n/).map(p => p.trim()).filter(Boolean).slice(0, 3); // limit to top 3
    }

    if (part && !aiParts.includes(part)) aiParts.unshift(part); // put user part first
    aiParts = aiParts.slice(0, 3); // ensure max 3

    const partsLinks: string[] = [];
    aiParts.forEach((p) => {
      // Include vehicle info only if it exists
      const queryWithVehicle = [year, make, model, p].filter(Boolean).join(" ");
      const querySimple = p;
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(queryWithVehicle)}`);
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(querySimple)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(queryWithVehicle)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(querySimple)}`);
    });

    // Deduplicate and limit to top 3
    const topPartsLinks = Array.from(new Set(partsLinks)).slice(0, 3);

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


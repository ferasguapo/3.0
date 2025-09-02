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

    // If only code is provided, use a simple targeted query
    if (code) {
      queries.push(`how to repair diagnose ${code}`);
    }

    // Separate query for part if provided
    if (part) {
      queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
    }

    // Fallback general repair query
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    if (generalQuery) queries.push(`${generalQuery} repair`);

    // Deduplicate and limit to top 3
    const uniqueQueries = Array.from(new Set(queries));
    const youtubeLinks = uniqueQueries.slice(0, 3).map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Parts links (Amazon & eBay) ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the specific parts or components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list of parts.`;
      const partsText = await callAI(partsPrompt);
      aiParts = partsText.split(/,|\n/).map(p => p.trim()).filter(Boolean);
    }
    if (part && !aiParts.includes(part)) aiParts.push(part);

    const partsLinks: string[] = [];
    aiParts.forEach((p) => {
      const baseQuery = [year, make, model, p].filter(Boolean).join(" ");
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(baseQuery)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(baseQuery)}`);
    });

    if (!partsLinks.length && generalQuery) {
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(generalQuery)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(generalQuery)}`);
    }

    // Limit to top 3
    const topPartsLinks = partsLinks.slice(0, 3);

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

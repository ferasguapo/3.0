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

    if (code && !part && !year && !make && !model) {
      // Only OBD-II code provided → highly targeted search
      queries.push(`how to repair diagnose ${code}`);
    } else {
      // If OBD-II code is provided with other info
      if (code) {
        let q = `how to fix ${code}`;
        if (year || make || model) {
          q += ` ${[year, make, model].filter(Boolean).join(" ")}`;
        }
        queries.push(q);
      }
      // If part is provided
      if (part) {
        queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
      }
      // General fallback
      const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
      if (generalQuery) queries.push(`${generalQuery} repair`);
    }

    const uniqueQueries = Array.from(new Set(queries));
    const youtubeLinks = uniqueQueries.map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Generate parts links from Amazon & eBay ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the specific parts or components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list of parts.`;
      const partsText = await callAI(partsPrompt);
      aiParts = partsText.split(/,|\n/).map(p => p.trim()).filter(Boolean);
    }
    if (part && !aiParts.includes(part)) aiParts.push(part);

    const partsLinks: string[] = [];
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    aiParts.forEach((p) => {
      const baseQuery = [year, make, model, p].filter(Boolean).join(" ");
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(baseQuery)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(baseQuery)}`);
    });

    if (!partsLinks.length && generalQuery) {
      partsLinks.push(`https://www.amazon.com/s?k=${encodeURIComponent(generalQuery)}`);
      partsLinks.push(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(generalQuery)}`);
    }

    // --- Build final data object ---
    const finalData: any = {
      overview: normalized.overview || "No overview available",
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: normalized.time_estimate || "N/A",
      cost_estimate: normalized.cost_estimate || "N/A",
      parts: partsLinks,
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

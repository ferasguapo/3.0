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

    // --- Build AI prompt for diagnostics & repair instructions ---
    const userPrompt = [
      year || make || model ? `Vehicle: ${[year, make, model].filter(Boolean).join(" ")}` : "",
      part ? `Part: ${part}` : "",
      code ? `OBD-II Code: ${code}` : "",
      notes ? `Notes: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const aiText = await callAI(userPrompt);
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // --- Get AI-suggested parts for OBD-II code ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the specific parts or components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list of parts.`;
      const partsText = await callAI(partsPrompt);
      aiParts = partsText.split(/,|\n/).map(p => p.trim()).filter(Boolean);
    }

    // --- Generate targeted YouTube search links ---
    const queries: string[] = [];

    // OBD-II code search
    if (code && aiParts.length) {
      queries.push(`how to fix ${code} ${aiParts.join(" ")} ${year ?? ""} ${make ?? ""} ${model ?? ""}`);
    } else if (code) {
      queries.push(`how to fix ${code} ${year ?? ""} ${make ?? ""} ${model ?? ""}`);
    }

    // Part-specific search
    if (part) queries.push(`${part} ${year ?? ""} ${make ?? ""} ${model ?? ""} repair tutorial`);

    // General vehicle repair search
    queries.push(`${year ?? ""} ${make ?? ""} ${model ?? ""} ${part ?? ""} repair`);

    const uniqueQueries = Array.from(new Set(queries));
    const youtubeLinks = uniqueQueries.map(
      (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Generate O'Reilly parts search links ---
    const allPartsForSearch: string[] = aiParts.length ? aiParts : [part ?? ""];
    const partsLinks = allPartsForSearch
      .filter(Boolean)
      .map((p) => `https://www.oreillyauto.com/search/results?q=${encodeURIComponent(`${year ?? ""} ${make ?? ""} ${model ?? ""} ${p}`)}&searchType=products`);

    // Fallback if no parts suggested
    if (!partsLinks.length) {
      partsLinks.push(`https://www.oreillyauto.com/search/results?q=${encodeURIComponent(`${year ?? ""} ${make ?? ""} ${model ?? ""}`)}&searchType=products`);
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

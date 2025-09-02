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
      "Please provide the response formatted as:\n" +
      "📝 Overview\n🔍 Diagnostic Steps\n🛠 Repair Steps\n🔧 Tools Needed\n⏱ Estimated Time\n💰 Estimated Cost"
    ].filter(Boolean).join("\n");

    const aiText = await callAI(userPrompt);
    const parsed = coerceToJSONObject(aiText);
    const normalized: NormalizedData = normalizeToSchema(parsed);

    // --- YouTube tutorial links ---
    const queries: string[] = [];
    if (code) queries.push(`how to repair diagnose ${code}`);
    if (part) queries.push(`${part} ${[year, make, model].filter(Boolean).join(" ")} repair tutorial`);
    const generalQuery = [year, make, model, part].filter(Boolean).join(" ");
    if (generalQuery) queries.push(`${generalQuery} repair`);

    const youtubeLinks = Array.from(new Set(queries)).slice(0, 3).map(
      q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    );

    // --- Parts links (O'Reilly, AutoZone, Advanced Auto Parts) ---
    let aiParts: string[] = [];
    if (code) {
      const partsPrompt = `List the top 3 most likely parts/components that could cause OBD-II code ${code} in ${year ?? ""} ${make ?? ""} ${model ?? ""}. Provide only a comma-separated list, prioritize common parts.`;
      const partsText = await callAI(partsPrompt);

      aiParts = partsText
        .split(/,|\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.startsWith("{") && !p.startsWith("[") && !p.toLowerCase().includes("overview"));
    }

    if (part && !aiParts.includes(part)) aiParts.unshift(part);
    if (aiParts.length === 0 && part) aiParts = [part];

    const partForStores = [
      aiParts[0] || "",
      aiParts[1] || aiParts[0],
      aiParts[2] || aiParts[0],
    ];

    const topPartsLinks = [
      `https://www.oreillyauto.com/search?query=${encodeURIComponent([year, make, model, partForStores[0]].filter(Boolean).join(" ") || partForStores[0])}`,
      `https://www.autozone.com/searchresult?searchText=${encodeURIComponent([year, make, model, partForStores[1]].filter(Boolean).join(" ") || partForStores[1])}`,
      `https://shop.advanceautoparts.com/search?searchText=${encodeURIComponent([year, make, model, partForStores[2]].filter(Boolean).join(" ") || partForStores[2])}`,
    ];

    // --- Forum links (Reddit, car forums, etc.) ---
    const forumQueries: string[] = [];
    if (code) forumQueries.push(`reddit ${code} ${make ?? ""} ${model ?? ""} forum`);
    if (part) forumQueries.push(`${part} ${make ?? ""} ${model ?? ""} repair forum`);
    if (generalQuery) forumQueries.push(`${generalQuery} car forum`);

    const forumLinks = Array.from(new Set(forumQueries)).slice(0, 3).map(
      q => `https://www.google.com/search?q=${encodeURIComponent(q)}`
    );

    // --- Build final response (emoji only on section titles) ---
    const finalData: any = {
      overview: `📝 Overview\n${normalized.overview || "No overview available"}`,
      diagnostic_steps: normalized.diagnostic_steps ?? [],
      repair_steps: normalized.repair_steps ?? [],
      tools_needed: normalized.tools_needed ?? [],
      time_estimate: `⏱ Estimated Time\n${normalized.time_estimate || "N/A"}`,
      cost_estimate: `💰 Estimated Cost\n${normalized.cost_estimate || "N/A"}`,
      parts: topPartsLinks,
      videos: youtubeLinks,
      forums: forumLinks,
    };

    return NextResponse.json({ ok: true, data: finalData, raw: aiText }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}


// src/lib/scraper.ts
// Return stable search URLs instead of scraping external sites.
// This avoids fragile HTML scraping and blocked requests on serverless platforms.

export async function scrapeOreilly(query: string): Promise<string[]> {
  if (!query || !String(query).trim()) return [];
  const q = encodeURIComponent(String(query).trim());
  // Return up to 3 search URLs for convenience (same base search, but included for compatibility)
  return [
    `https://www.oreillyauto.com/search?q=${q}`,
    `https://www.oreillyauto.com/search?q=${q}&page=2`,
    `https://www.oreillyauto.com/search?q=${q}&page=3`,
  ];
}

export async function scrapeYoutube(query: string): Promise<string[]> {
  if (!query || !String(query).trim()) return [];
  const q = encodeURIComponent(String(query).trim());
  // Return three YouTube search links related to the query (no scraping)
  return [
    `https://www.youtube.com/results?search_query=${q}+diagnostic`,
    `https://www.youtube.com/results?search_query=${q}+repair`,
    `https://www.youtube.com/results?search_query=${q}+how+to`,
  ];
}

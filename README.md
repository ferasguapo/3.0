# obuddy5000 – Vercel-ready

A clean, professional UI for vehicle diagnostics that calls an AI provider (OpenAI or Anthropic) and **forces JSON** responses. Includes post-processing that extracts or wraps text as valid JSON so the UI never crashes.

---

## Tech
- Next.js 14 (App Router, TypeScript)
- TailwindCSS
- API route with provider-agnostic AI call
- JSON post-processing (server) + pretty JSON render (client)

---

## Local Setup

```bash
pnpm i        # or npm i / yarn
pnpm dev
```

Create a `.env.local` file at the project root with your keys:

```env
# Choose your default provider (openai | anthropic)
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o-mini

# Pass default provider to client dropdown (optional)
NEXT_PUBLIC_DEFAULT_PROVIDER=openai
NEXT_PUBLIC_DEFAULT_MODEL=gpt-4o-mini

# Provider keys (set only those you need)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
```

Open http://localhost:3000

---

## Deploy to Vercel

1. **Create a new Vercel project** from this repo.
2. In **Project Settings → Environment Variables**, add:
   - `DEFAULT_PROVIDER` = `openai` (or `anthropic`)
   - `DEFAULT_MODEL` = (e.g.) `gpt-4o-mini` or `claude-3-5-sonnet-20240620`
   - `OPENAI_API_KEY` (if using OpenAI)
   - `ANTHROPIC_API_KEY` (if using Anthropic)
   - (optional UI defaults) `NEXT_PUBLIC_DEFAULT_PROVIDER`, `NEXT_PUBLIC_DEFAULT_MODEL`
3. Set the variables for **Production**, **Preview**, and **Development**.
4. Deploy.

> No other settings required. The API route runs on the Node.js runtime.

---

## How it handles JSON safely

- The system instructs the model to **return JSON only** and uses OpenAI's `response_format: { type: "json_object" }` where available.
- On the server, we try to `JSON.parse()` the response. If that fails, we:
  1. Try to extract the first JSON-looking block with a regex.
  2. If still no dice, wrap the text as `{ "message": "…raw output…" }`.
- The client always renders `data` with `JSON.stringify(data, null, 2)` to keep it readable and stable.

---

## API Contract

`POST /api/diagnose`

```json
{
  "year": "2009",
  "make": "Toyota",
  "model": "Camry",
  "part": "Ignition coil",
  "code": "P0303",
  "notes": "Rough idle and flashing MIL",
  "provider": "openai",
  "modelName": "gpt-4o-mini"
}
```

**Response**

```json
{
  "ok": true,
  "data": {
    "summary": "...",
    "trouble_code": "P0303",
    "probable_causes": ["...", "..."],
    "tests": [{"name":"...", "steps":["..."]}],
    "recommended_parts": ["..."],
    "estimated_difficulty": "moderate",
    "next_actions": ["..."]
  },
  "raw": "{...original model text...}"
}
```

On error:

```json
{ "ok": false, "error": "Message..." }
```

---

## Customize the Prompt

Edit `app/api/diagnose/route.ts` and adjust the keys or structure you want back from the model.

---

## Notes

- If you prefer the **Edge runtime**, flip `export const runtime = "nodejs"` to `"edge"` and ensure any libraries used are edge-safe.
- If you want to add providers, extend `lib/ai.ts`.
- To harden the UI further, you can add a Zod schema to validate `data` before rendering.

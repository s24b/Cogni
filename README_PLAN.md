# README Planning Doc
*Working notes — delete before shipping*

## Format decisions
- Screenshots: PNG (Arshawn will take)
- Diagrams/architecture: SVG (Claude will generate inline)
- Repo: public on GitHub (s24b/Cogni)
- Both SVG and PNG render natively in GitHub markdown

## Audience
- Primary: students who want to self-host (technical, assume developer knowledge — no explaining what Supabase is)
- Secondary: recruiters / engineers viewing as portfolio

## Tone
- Confident and direct. Not marketing-y, not over-humble.
- No fluff words: "powerful," "seamless," "blazing fast," "robust" — banned
- No first-person ("I built this because...") — keep it about the product
- Short sentences. If a sentence needs a comma, split it.
- Let features speak technically: "FSRS spaced repetition at card and topic level" not "intelligent flashcard scheduling that adapts to how you learn"
- Honest about scope: self-hosted, single-user, BYOK, active project — don't pretend it's a SaaS
- Closest analog: Linear or Resend READMEs — clean, technical, no nonsense, quietly confident

## Technical depth approach — LAYERED
- **Top half:** product-level. Hook in 60 seconds. No implementation details.
- **Architecture section:** selectively deep. Call out non-obvious engineering decisions to impress recruiters who keep reading.
- **Setup section:** step-by-step but assumes developer. Doesn't explain basics.
- **Never explain:** what Next.js is, what TypeScript is, what OAuth is, anything a junior dev already knows.
- Key things to highlight in architecture (signal engineering sophistication):
  - FSRS spaced repetition at two levels (card + topic)
  - Karpathy-style wiki pattern for agent memory
  - Atomic Postgres RPC for FSRS + mastery update
  - Streaming agents with Anthropic's native web search tool
  - pgvector RAG with keyword fallback

## Structure (in order)

### 1. Hero banner image
- Full-width image at the very top — NO text above it (like nanobot example)
- Image: TBD — Arshawn will provide

### 2. Badge row
- License (AGPL-3.0), stack badges, Vercel deploy button
- Sits directly below the hero image

### 3. Intro blurb (SHORT — hook only, not deep)
- Line 1: What it is (one sentence)
- Line 2: The core problem it solves and who it's for (one sentence)
- Line 3: The key idea — BYOK, self-hosted, AI agents, FSRS (one sentence)
- Purpose: get someone to decide "I want to keep reading" before they've seen screenshots
- Depth lives in Features and Architecture sections below — NOT here

### 4. 📸 Screenshots grid
- Today tab
- Courses detail
- Progress tab
- Tutor split-screen (flashcard/quiz view)
- TBD: others Arshawn wants to include

### 5. 🧠 Features (highlights — ~8–10 bullets, not exhaustive)
- What it does in detail
- Focus on what's impressive and non-obvious

### 6. ⚙️ Architecture (how it works — selectively deep)
- The interesting engineering decisions (see list above)
- SVG diagram or ~10 bullets — TBD

### 7. 🛠️ Tech stack
- Clean table or badge list

### 8. 🚀 Setup / Deployment
- Upfront warning: ~30 min, requires Supabase + Vercel accounts
- Step 1: Fork + Vercel one-click deploy
- Step 2: Supabase project setup — reference supabase/README.md for exact SQL order, don't duplicate it here
- Step 3: Env vars table (all required vars)
- Step 4: Google OAuth setup
- Step 5: Optional — OpenAI key (what it unlocks: RAG + audio overviews)
- Step 6: Optional — Google Calendar

### 9. 🔑 BYOK / API keys
- Anthropic key: required, link to console, ~$2–5/month estimate for typical student usage
- OpenAI key: optional, what it unlocks

### 10. 💻 Local development
- `npm run dev` instructions
- No VPS docs (Cron Jobs are Vercel-native, would require rework)

### 11. 📄 License
- AGPL-3.0 note

### 12. ⚠️ Active project note (placed LOW — after license)
- Wording: "Cogni is an active personal project. Some features may have rough edges — contributions and bug reports are welcome."

## Open questions
- Architecture: SVG diagram vs. bullet breakdown? (leaning bullets for simplicity)
- Screenshots: which specific screens beyond the 4 listed?
- Hero image: TBD from Arshawn

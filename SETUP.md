# FlowState — Setup Guide

A focus-first workflow tool for content creators. Dark theme, Duolingo-style gamification, Pomodoro timer, and granular step-by-step tasks for every content type.

---

## 1. Create GitHub repo

1. Go to github.com → New repository
2. Name it `flowstate` (or whatever you like)
3. Private or public — your choice
4. Do NOT initialise with README (you already have files)
5. Follow GitHub's instructions to push this folder:

```bash
git init
git add .
git commit -m "Initial FlowState commit"
git remote add origin https://github.com/YOUR_USERNAME/flowstate.git
git push -u origin main
```

---

## 2. Set up Supabase

1. Go to supabase.com → New project
2. Choose a name, password, and region
3. Wait for it to start (~1 min)
4. Go to **SQL Editor** → paste and run `supabase/schema.sql`
5. Then paste and run `supabase/seed.sql`
6. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

---

## 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 4. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## 5. Deploy to Vercel

1. Go to vercel.com → New Project → Import from GitHub
2. Select your `flowstate` repo
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click Deploy

Your app will be live at `flowstate.vercel.app` (or your custom domain).

---

## How the app works

**Home screen (`/`)** — Shows a START button. If you have a priority session set, it jumps straight to Focus Mode for your most important task.

**Workflow selector (`/workflows`)** — Choose a content type (YouTube Short, Tweet, etc.), give it a name, and create a session.

**Stages overview (`/workflow/[id]`)** — See all stages (Idea → Script → Record → Edit → Upload) and all tasks. Check them off as you go. Click "Focus" on any task to open Focus Mode for just that task.

**Focus Mode (`/workflow/[id]/focus`)** — One task fills the screen. Pomodoro timer on the right. Sound effects and confetti when you complete tasks. Navigates automatically to the next incomplete task.

---

## Adding more workflow types

To add workflows beyond the 3 seeded ones (YouTube Short, Tweet, Instagram Post):

1. Open `supabase/seed.sql`
2. Copy the pattern from one of the existing `DO $$` blocks
3. Change the `slug` to match a workflow type (e.g. `youtube-longform`, `tiktok`)
4. Add your stages and tasks
5. Run the new block in Supabase SQL Editor

The full task lists for YouTube Longform and Instagram Reel are in `lib/data.ts` — you can use those as reference for the SQL.

---

## Customising tasks

Tasks live in Supabase. You can edit them directly in:
- **Supabase Table Editor** → `tasks` table → click any row to edit
- Or via the SQL editor

Each task has:
- `title` — short name shown in lists
- `description` — one-line summary
- `instructions` — the full detailed instructions shown in Focus Mode
- `estimated_minutes` — shown as a time hint
- `has_prompt` + `prompt_text` — if true, a "Copy Claude Prompt" button appears
- `resource_url` — if set, an "Open Resource" button appears

---

## Tech stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS** (dark theme, cyan accent)
- **Framer Motion** (animations)
- **Supabase** (PostgreSQL backend)
- **canvas-confetti** (celebrations)
- **Web Audio API** (sound effects — no extra library needed)

---

## What's next (after you're happy with the look)

- Add auth (Supabase Auth) so multiple users can have separate sessions
- Add a streak counter (track consecutive days you complete at least one task)
- Add analytics (time spent per stage, tasks per day)
- Add more workflow types (Podcast episode, Newsletter, Blog post)
- Add a notes field per task session
- Export completed workflow as a checklist PDF

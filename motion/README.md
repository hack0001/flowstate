# Motion Studio

Animated video templates (Remotion) edited from the **Motion Studio** page (`/motion`).

- `motion/system/` — SoundMoney brand colours, fonts (woff2 in `public/motion/fonts`), icon set.
- `motion/templates/kinetic-short/` — the 60 s vertical Kinetic Short: `KineticShort.tsx` (animation code), `meta.ts` (scene list + presets), `presets/` (content for each video).
- `motion/remotion/` — entry for the Remotion CLI / Studio.
- Saved projects: Supabase table `motion_projects` (run `supabase/migrations/052_motion_projects.sql` once).

## Workflow
1. Open `/motion`, pick a preset (Projects → Start new from), edit scene text/numbers/icons, watch the preview.
2. Save (stored in Supabase). Click **Props JSON** and put the file in the repo root.
3. Render: `npm run motion:render -- KineticShort out/my-short.mp4 --props=./my-short.json --crf=18`
   - One segment only: `KS-01` … `KS-16` instead of `KineticShort`.
   - Browse everything in Remotion Studio: `npm run motion:studio`.
4. Media slots: put files in `public/motion/media/` and set the slot's `src` to `motion/media/<file>`; tick `video` for clips.

Licence: Remotion is free for individuals and companies of up to 3 people. See remotion.dev/license.

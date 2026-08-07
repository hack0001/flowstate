# SoundMoney — Premiere Pro Template Setup Guide

One-time build. Follow this top to bottom, in order. Once done, every future video is `File > Save As` off one of the two templates — never a blank project again.

## Part 1 — Install the full Inter font family (do this first)

1. Go to fonts.google.com/specimen/Inter, click **Download family** (top right).
2. Unzip it, open the `static` folder — one `.ttf` per weight (Inter-Regular, Inter-Medium, Inter-SemiBold, Inter-Bold, Inter-ExtraBold, Inter-Black, etc.).
3. Install all of them. **Windows:** select every `.ttf` in that folder, right-click > Install. **Mac:** double-click each one and click "Install Font" in Font Book, or drag the whole folder into Font Book.
4. Restart Premiere Pro so it picks up the new fonts. Without this step, the Essential Graphics font-style dropdown won't show "Inter Black" or "Inter Bold" as separate options — only whatever was already installed.

## Part 2 — Build the Shorts template project

1. Premiere Pro > New Project > name it `SoundMoney_Short_TEMPLATE` > save it into a dedicated Templates folder you won't touch again except to Save As from.
2. File > New > Sequence > click the **Settings** tab (not a preset) > Editing Mode: Custom > Frame Size: `1080 x 1920` > Frame Rate: match what you actually shoot at (30fps typical) > Pixel Aspect Ratio: Square Pixels > OK. Name the sequence `Short_Main`.
3. In the Timeline, add tracks until you have 5 video + 3 audio (right-click the track header area > Add Tracks).
4. Rename every track: double-click directly on the track name text in the header. `V1` VO-visual, `V2` B-roll, `V3` Memes, `V4` Text, `V5` Captions. `A1` VO, `A2` Music, `A3` SFX.
5. Add the LUT: Project panel > right-click > New Item > Adjustment Layer > OK. Drag it onto a new `V6` track above V5. Select it > Effects panel > search "Lumetri Color" > drag onto the adjustment layer > Effect Controls > Basic Correction > Input LUT > Browse > select your `.cube` file.

## Part 3 — Build the caption style once, save it, reuse forever

1. Import or record a placeholder VO clip onto A1.
2. Window > Text (or Essential Graphics on older versions) > select the clip > **Transcribe Sequence**.
3. Once done, click **Create Captions** > Subtitle preset > OK. Drag the resulting caption track onto V5.
4. Select one caption clip > Window > Essential Graphics > Edit tab.
5. Style it:
   - **Font** — click into the font name field (not the B toolbar button), type "Inter", pick **Inter Bold** from the dropdown list that appears.
   - **Fill** — click the color swatch, enter `F0ECE2`.
   - **Stroke** — enable, color `16181C`, width 2-4px.
   - **Shadow** — enable, subtle (low opacity, small distance).
6. With it still selected, Essential Graphics > Edit tab > **Styles** dropdown near the top > **Create Style** > name it `SM Caption` > OK.
7. Done — any future caption clip: select it, open the Styles dropdown, pick `SM Caption`. One click, fully styled.

## Part 4 — Build the callout graphics + their 3 color variants (9 mogrts total)

**SM Typewriter:**
1. On the Text track (V4), Type tool (T) on the Program monitor, type a placeholder like "THE REAL NUMBER".
2. Essential Graphics > Edit tab > Font **Inter Black** (900) > Fill `F0ECE2`. Optional: Graphics > New Layer > Rectangle behind it, fill `16181C`, as a background panel.
3. Select the text clip > Effects panel > search "Linear Wipe" > drag onto the clip.
4. Effect Controls > Linear Wipe: Wipe Angle `90°` (preview — flip to `270°` if it reveals backwards), Feather `0`.
5. Playhead at clip start > click the stopwatch next to "Transition Completion" > set `100%`. Move playhead ~0.5s later > set `0%` (auto-creates the second keyframe).
6. Drop a keyboard-clack SFX on A3 under the reveal.
7. Right-click the clip > **Export As Motion Graphics Template** > Local Templates Folder > name it `SM Typewriter`.
8. Duplicate the graphic, change the fill/background to the gold accent `B8935A`, re-export as `SM Typewriter - Gold`. Repeat for teal `2FB8AC` (`SM Typewriter - Teal`) and red `C15049` (`SM Typewriter - Red`).

**SM Pop:** same process, but instead of Linear Wipe, keyframe Motion > Scale: `0%` at clip start → `115%` partway → settle at `100%`, roughly 0.3 seconds total, ease-out on the last keyframe. Export + 3 color variants same as above.

**SM End Card:** static graphic, last ~2 seconds — your handle/logo + "Follow for more", charcoal background. Export + 3 color variants same as above.

You now have 9 mogrts. They live in **Essential Graphics > Browse**, under your Local Templates Folder — this is a global location on your machine, not tied to this one project.

## Part 5 — Build the Longform template (reuses the 9 mogrts, don't rebuild them)

1. New Project > name it `SoundMoney_Longform_TEMPLATE`.
2. New Sequence > Settings tab > Custom > Frame Size `1920 x 1080` > same frame rate as the Short > Square Pixels > name it `Longform_Main`.
3. Same track renaming as Part 2 step 4, same LUT adjustment layer as Part 2 step 5.
4. Build the caption style again in this project (Essential Graphics styles are saved per-project, not shared automatically) — same steps as Part 3, same name `SM Caption`, adjust size for the wider frame.
5. Essential Graphics > **Browse** tab — your 9 mogrts from Part 4 should already be listed (saved to the Local Templates Folder, not the Short project file). Drag one in to confirm it works.
6. Build 2 more graphics only long-form needs, same 3-color-variant pattern:
   - **SM Title Card** — full-screen, charcoal background, headline in Inter Black in the accent color. Used for chapter breaks.
   - **SM Lower Third** — accent-color bar + Inter Bold white text. Used for naming a source or chart.

## Part 6 — Starting a new video

1. You already know the format (long-form or Short) from the Idea & Validation stage.
2. `File > Save As`, open whichever template matches, save into that video's own project folder with its real name (e.g. `2024-XX_topic-name.prproj`). Never edit inside the template file itself — always Save As first so it stays clean for next time.
3. Drag in the real VO/b-roll/memes, apply `SM Caption` to captions, drag in whichever colored mogrt matches this video's accent (set back in Holy Trifecta).

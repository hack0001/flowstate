# SoundMoney — Visual Brand Kit

Reference file for thumbnail and packaging generation. Upload this to a Claude Project's knowledge, or paste it at the start of any chat where Claude is helping design or describe a SoundMoney thumbnail, title card, or channel graphic — it should follow these values exactly, not approximate them.

## Colors

One base, used everywhere. Three accents, each with a specific job — never decorative, never interchangeable.

| Role | Hex | RGB | When to use it |
|---|---|---|---|
| Base | `#16181C` | 22, 24, 28 | Background on every thumbnail and graphic, no exceptions. |
| Gold accent | `#B8935A` | 184, 147, 90 | Wealth-protection, gold, and monetary-history videos. |
| Teal accent | `#2FB8AC` | 47, 184, 172 | Inflation data and "how money works" explainer videos. |
| Red accent | `#C15049` | 193, 80, 73 | Urgency/alarm framing (savings being eaten, doom-adjacent headlines). Use sparingly — it's the loudest of the three and loses impact if overused. |
| Text | `#F0ECE2` | 240, 236, 226 | Body/headline text on the charcoal base. |

**Hard rule:** never more than 2 accent colors on one thumbnail, and never all 3 together. Pick one as primary (headline color) for the video's content type, and at most one more for a secondary element (the big stat/number).

## Font

**Family:** Inter (free, Google Fonts — fonts.google.com/specimen/Inter)

| Numeric weight | Standard name | Use it for |
|---|---|---|
| 900 | Black | The big stat/number on thumbnails. Heaviest weight, maximum impact. |
| 700 | Bold | Headlines, video titles on-screen, callout text. |
| 600 | SemiBold | Tags, subtext, small labels. |

**Getting the exact weight in Canva:** the toolbar Bold (B) button only toggles a font's built-in Regular/Bold — it cannot reach Black. Click directly into the font name field, type "Inter", and pick the specific named weight from the dropdown list (Inter, Inter Medium, Inter SemiBold, Inter Bold, Inter Black, etc.) — each is its own list entry, not a style modifier. If "Inter Black" isn't available on your account, upload the desktop `.ttf` as a custom brand font (Brand Kit > Fonts > Upload) rather than settling for a lighter weight.

**In Premiere Pro / Photoshop:** download the full Inter family (all static weights) from Google Fonts, install every `.ttf`, then restart the app. The Essential Graphics / Character panel font-style dropdown will then list each weight by name (Inter Black, Inter Bold, Inter SemiBold, etc.) once installed system-wide.

**Why Inter over Montserrat:** Inter was designed specifically for screen/UI legibility at small sizes, which is exactly the constraint a YouTube thumbnail has (must read clearly at ~120px wide in a mobile grid). Montserrat is a more decorative, Art-Deco-influenced geometric font — it has more visual flourish, but it's also the single most overused font in YouTube finance/business thumbnails, so it reads as generic rather than distinctive. Inter's neutral, restrained character fits SoundMoney's "credible analyst, not hype merchant" positioning better, and its Black weight stays crisp at small sizes where Montserrat's heavier cuts can look soft.

## Thumbnail composition rules

- Combine at least 2 of these 4 types (never just 1 — single-formula thumbnails are average): subject next to something bigger (scale/context), comparison (before/after, cheap/expensive), blur or obscure the main result (forces the click), big number or stat (instant curiosity).
- Max 5 words of on-thumbnail text, high contrast, no face — use charts, money visuals, or bold typography instead.
- Check legibility at 120px wide (how it actually renders in the mobile grid) before finalizing.

## Shorts vs. long-form

Same palette and font on both — brand recognition depends on this never changing. Composition differs:

- **Shorts (9:16):** bigger, bolder text. 3–4 words max. Keep everything inside the centre-safe zone, away from the bottom-right corner where YouTube's UI overlay sits.
- **Long-form (16:9):** more room. Headline can run a full sentence and sit next to a supporting chart or image.

## Instruction for Claude

When asked to generate, describe, or critique a SoundMoney thumbnail, title card, lower-third, or any channel graphic: use only the 5 hex codes above, use only Inter at the 3 weights specified, follow the max-2-accents rule, and match the correct accent to the content type (gold = wealth/history, teal = data/explainer, red = urgency — sparingly). Flag any request that would violate these rules (a third accent color, a different font, text too small to read at thumbnail size) rather than silently complying.

# T-288 — App Store screenshots in «Пьеса»: Literata, the main word italic in the app's lilac

Owner's decision 20.11: «Пьеса, да скриншоты и видео одним шрифтом и стилистикой».

## What changed

- `e2e/store/fonts/` — Literata (upright and italic, variable, `opsz` + `wght`), Caveat, Inter Tight, from
  github.com/google/fonts (`ofl/literata`, `ofl/caveat`, `ofl/intertight`), each family's `OFL.txt` beside it.
- `compose.swift` / `compose.mjs` — the screenshots' captions in Literata 600 (`opsz` = the size, ≤ 72), lines 1.1
  apart, flush left on the window's left edge (x 127 of 1320: each line's first ink there), the block in the same
  band. The main word, `[…]` in captions.json, in Literata Italic 600 at the same size, `#C084FC`; the brackets are
  never printed; an italic correction keeps upright punctuation after the italic word clear of it. One size a
  language (≤ 104 px, the widest line within the window's width). Background, glow, window, corners unchanged.
  No font of the system's anywhere: the video's captions and card, until T-289, take Inter Tight 700 from `fonts/`
  instead of SF Pro, and their brackets are taken out (`plain`).
- `captions.json` — the natives' ready blocks (`screenshots`, `hook`, `hookByDay`, `video`, `finale`, `signIn`),
  words unchanged (checked by script against the old file, no-break spaces in «12 из 12» etc. kept), en-GB = en-US.
  es: "?" outside the brackets in all eight hooks (`el [martes]?`, RAE); `video[1]` «Marca tu semana / [una vez]».
  `video[6]` (old slogan) kept for today's video.
- `README.md` — the look, the fonts and their licence, the markup, the alignment; the screenshots and the video
  in one style (the video from T-289).

## Type size per language (1320×2868)

| locale | type |
|---|---|
| en-US | 103 px |
| en-GB | 103 px |
| ru | 90 px |
| es-ES | 86 px |
| de-DE | 87 px |

## Evidence

- `red-before.txt` — the new tests on the old composer: fonts undefined (SF Pro), brackets printed, lines centred.
- `green.txt` — store-compose 11/11, store-video 24/24, knip clean, compose of every language.
- `en-US.png`, `en-GB.png`, `ru.png`, `es-ES.png`, `de-DE.png` — the eight pictures of each language in a row
  (`compose sheet`). Looked over by Claude: the main word italic and lilac in each, no bracket, every line on the
  window's left edge, nothing clipped.
- `es-hooks-question-mark.png` — the seven es hooks set as these captions: the upright "?" clear of the italic
  s / o in every day.
- `T-288-natives-brief.md`, `T-288-natives-{ru,en,es,de}.md` — the brief and the natives' reports.

## Notes

- Vision reads italic Cyrillic «из» as "u3" (the italic forms of и and з): the read-back test folds u→и and 3→з on
  both sides; every other letter must match.
- `npm test` stops at its first stage here: three check-secrets fixture tests fail with git exit 128 — the sandbox
  refuses the synthetic `.env`-named fixtures. Untouched by this task; the store tests were run directly.
- No app change, so no e2e flow; the store's own tests are the check.

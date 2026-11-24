# T-290 — red before, on e23d16a

The new tests (commit 57a7fe6, `e2e/__tests__/store-video.test.mjs`) run with
montage.mjs and compose.swift as they were on e23d16a:

    git restore --source=e23d16a -- e2e/store/montage.mjs e2e/store/compose.swift
    node --test e2e/__tests__/store-video.test.mjs
    git restore --source=HEAD -- e2e/store/montage.mjs e2e/store/compose.swift

```
  ✖ a hole goes with its element in the frames it moves in: the month pushed down 62 points in 8 frames at a moment of chance after the tap, the hole's centre within 4 px of the day's in every frame (8639.879333ms)
  ✖ the app's words never read on from a caption's line: on each line's height, from its last letter 300 px on, outside the holes, no brighter than 25 of 255 — a short first line too («…or sync») (866.067042ms)
  ✖ the light lags its element: more than two frames in a row off it, and the video is refused (1.469958ms)
  ✔ round every caption and the finale the app's white comes through no brighter than 20 of 255, outside the letters (3539.4675ms)
✖ made by ffmpeg, its layer by compose.swift (166327.422958ms)
ℹ pass 32
ℹ fail 3
✖ failing tests:
✖ a hole goes with its element in the frames it moves in: … (8639.879333ms)
  AssertionError [ERR_ASSERTION]: pushed from frame 32 of 50 a second (0.64 s); frames 0.567:853.5/853 0.600:853.5/853 0.633:853.5/853 0.667:884.5/853 0.700:899/853 0.733:931.5/853 0.767:962/853 0.800:978/853 0.833:978/867 0.867:978.5/896 0.900:978.5/924.5 0.933:978.5/945.5 0.967:978.5/959 1.000:978.5/968 1.033:978.5/974 1.067:978.5/976.5 1.100:978.5/977.5
  +   '0.667 s: day 884.5, hole 853',
  +   '0.700 s: day 899, hole 853',
  +   '0.733 s: day 931.5, hole 853',
  +   '0.767 s: day 962, hole 853',
  +   '0.800 s: day 978, hole 853',
  +   '0.833 s: day 978, hole 867',
  +   '0.867 s: day 978.5, hole 896',
  +   '0.900 s: day 978.5, hole 924.5',
  +   '0.933 s: day 978.5, hole 945.5',
  +   '0.967 s: day 978.5, hole 959',
  +   '1.000 s: day 978.5, hole 968',
  +   '1.033 s: day 978.5, hole 974'
✖ the app's words never read on from a caption's line: … (866.067042ms)
  AssertionError [ERR_ASSERTION]: «Who can make» at 2.47 s: 95 of 255 at 876,385
✖ the light lags its element: more than two frames in a row off it, and the video is refused (1.469958ms)
  TypeError [Error]: M.lightLags is not a function
```

The day (its centre in px of the video, `day/hole` a frame) is pushed down in
0.64–0.80 s; the old hole stays where it was until 0.83 s and glides after it
till 1.1 s: 12 frames off by up to 125 px. Beside the hook's first line the
app's white comes through at 95 of 255 (the plain shade) 300 px on.

The rule for the real recordings, red on e23d16a: see `rule-before.txt`.

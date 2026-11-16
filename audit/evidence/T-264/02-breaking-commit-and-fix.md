# T-264 — flow 86 red since 2bc021e: the flow, not the app, was out of date

## Which commit

97c9a65..d1c1be1 touches the server's notice texts in one commit only:
2bc021e "fix(i18n): T-261 second native reading — … Spanish project pushes in
quotes". It changed `server/i18n/pushNotifications.js` (es):

- `Ahora administras ${projectName}` → `Ahora administras el proyecto ${es(projectName)}`
- `Ya no formas parte del proyecto ${projectName}` → `Ya no formas parte del proyecto ${es(projectName)}`

It is an accepted change (the native reading of T-261, with its Jest in
`rehearsalNoticeText.integration.test.js`: "Spanish: the project in quotes after
"proyecto" in every notice about it"), but flow 86 was not updated with it and
still looked for `proyecto Fuenteovejuna` and `Ahora administras Fuenteovejuna`.

Proof, flow 86 unchanged, on HEAD with only `server/i18n/pushNotifications.js`
taken from 2bc021e^ (`git restore --source=2bc021e^ -- …`, then restored from HEAD):

```
[Passed] Rehearsal notices read right in Spanish, German and Russian (4m 38s)
1/1 Flow Passed in 4m 38s
```

and on HEAD as it is — red, see 01-red-before-HEAD.txt:

```
[Failed] Rehearsal notices read right in Spanish, German and Russian (1m 54s) (No visible element found: ".*Ya no estás en el proyecto.*Ya no formas parte del proyecto Fuenteovejuna.*")
```

## The fix (the flow)

The two Spanish cards are found as the other cards of the flow are, by what both
wordings share, and then checked word for word on the T-261 wording, a wrong one
added to `output.wrong` so the flow fails at its end naming it:

- removed: `Ya no formas parte del proyecto «Fuenteovejuna»`
- role: `Ahora administras el proyecto «Fuenteovejuna»`

Not a weaker check: the exact texts are stricter than before (article, quotes).

Updated flow, HEAD:

```
[Passed] Rehearsal notices read right in Spanish, German and Russian (5m 1s)
1/1 Flow Passed in 5m 2s
[e2e] taps taken again (tap-and-see.yaml): 0
```

Updated flow, the old (pre-2bc021e) Spanish texts — still red, the checks hold:

```
[Failed] Rehearsal notices read right in Spanish, German and Russian (4m 30s) (Assertion is false: id: words-not-as-a-native-speaker-writes-them is visible)
1/1 Flow Failed
```

# Contributing to CheckApp

CheckApp checks a real Android/iOS build against Apple App Store and Google
Play guidelines — usability included — before it ever reaches a human
reviewer. It's early: Phase 1 (see the architecture doc linked from the
README) covers a first slice of Android rules. Contributions that grow the
rule catalog, add the iOS inspector, or harden the Android one are all
welcome.

## Adding a rule

A rule is a plain object: `{ id, title, platform, severity, guideline, evaluate(data) }`.
`evaluate` takes the inspector's parsed data and returns `{ status, detail }`,
where `status` is one of `pass | fail | warn | info` and `severity` is one of
`critical | high | medium`.

1. Add the module under `src/rules/android/` (or `src/rules/ios/` once that
   inspector exists).
2. Register it in that platform's `index.js`.
3. Add both a passing and a failing test case in `test/rules.test.js`
   (or a new file, if the category is growing large), using the fixtures in
   `test/fixtures/` or new ones alongside them.
4. Cite the actual guideline section or Play/App Store Help page the rule
   enforces — "trust me" isn't a source. The full first-pass catalog (~30
   rules across 7 categories) is in the architecture document; that's a good
   place to find the next rule to implement and its rationale.

## Running the tests

```bash
npm install   # currently zero runtime dependencies, but keeps this future-proof
npm test
```

## Reporting a guideline that changed

Apple and Google both revise these rules over time (the target-SDK floor in
`src/rules/android/target-sdk.js` is a good example — it moves about once a
year). If you notice a rule citing an outdated requirement, that's a welcome
PR even without a new feature attached.

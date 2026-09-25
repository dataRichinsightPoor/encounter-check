# Encounter Check v0.2.0-alpha: verification record

## Automated

`npm test`: 58 of 58 pass (Node test runner): 38 engine tests and 20 drug tests. Coverage includes preset validity, conservation of cells and effectors, non-negativity, monotonicity, the no-effector analytic control, the encounter-limited analytic limit and its independence from target count, the encounter ceiling, the single-use cap and its ratio ceiling, the steady effector cycle rate, the exact time–density scaling identity, density-not-count invariance, geometry independence, the matched alternative, default hook numbers, ratio sufficiency under handling limitation, elasticity limits, search fraction, redesign, identifiability, Stokes settling, coverage flag, plate layout and size limit, validation, JSON round trip, CSV labeling and version consistency. The drug tests cover the mass balance and its monotone inversion, the bridge-index maximum at \(\sqrt{K_TK_E}\) and its symmetry, the exact EC50 identity (total = free + bound), the no-drug and no-depletion limits, depletion scaling with volume, the default drug numbers, the volume probe, validation, the plate dose axis and dose-response CSV.

## Browser

Chromium via Playwright at 1360 × 900 and 375 × 800, dark and light themes.

- No console or page errors on load, preset changes, runs, imports or exports.
- All four presets load and produce the expected badges: density and volume (both matter), saturated (ratio nearly sufficient, 3.0-point spread), single (single-use ceiling, lysis approaching E/T).
- Editing any input marks results stale and disables exports; Run restores them.
- Kill probability 1.4 is rejected with a readable message.
- A 108-well plate specification is rejected; 36 wells render.
- PNG, time-course CSV, plate CSV and scenario JSON downloads fire; exported JSON re-imports and recalculates.
- Heatmap clipped to its frame; color bar labels no longer collide with axis labels.
- Figure PNG: curve end labels added, axis title separated from the parameter lines, no disclaimer footer.
- Mobile: no horizontal page overflow; wide tables scroll inside their containers; metrics stack in one column.
- Methods page: 109 equations render; links to the tool, code and Markdown contract work.

## v0.2.0-alpha browser checks

- The bispecific preset loads with no console errors; the drug section, drug indices, rival caption and plate dose column appear only when the bridge is on, and disappear when it is switched off.
- Dose figure PNG, dose-response CSV, plate CSV, time-course CSV, figure PNG and scenario JSON all download.
- Dose chart checked in dark and light themes; the right axis label was clipped at "1000 nM" and now reads "1 µM" with more margin.
- A duplicate element id between the drug selector and the new section was found and renamed.
- Mobile: no horizontal page overflow; the drug table scrolls inside its container.
- Methods page: the new bridge equations render with no errors.

## Corrections made during QA

- The single-use ceiling was first stated as pE/T. With retries after failed contacts, the correct limit is min(1, E/T). Model, table label, regime card and math were corrected and a test added.
- A reference author list was corrected against the published article.

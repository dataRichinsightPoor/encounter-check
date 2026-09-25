# Encounter Check

99 Small Problems: Useful models for assumptions with expensive ambitions.  
No. 05 | Data-Rich, Insight-Poor | v0.2.0-alpha

Same E:T ratio. Same experiment? Encounter Check is an original browser model of effector–target killing in a well. Declare cell counts, the well, and a contact-and-killing mechanism, then see when the effector-to-target ratio describes the co-culture, when density does, and which plate design separates the two.

A ratio is a proportion of counts. Contact is a rate, and it depends on how crowded the space is where cells meet. In the synthetic default, a 1:1 co-culture in a flat 96-well gives 28.1% effector-attributed lysis at 4 h with 5,000 of each cell type, 41.1% with 10,000 and 54.2% with 20,000. The ratio never changed.

Version 0.2 adds an optional bispecific bridge. Cells bind drug in proportion to cells per volume, and the bridge between them sets the kill probability per contact. At a fixed 1:1 ratio, doubling density raises the plateau through contact and shifts the total EC50 right through depletion. At a 5 pM working dose the two nearly cancel: lysis runs from 18.4% to 24.5% across a 4-fold density span while the plateau runs from 27.7% to 53.5%.

## Open the model

- **[Try Encounter Check](https://datarichinsightpoor.github.io/encounter-check/):** no installation or sign-in; dark mode by default.
- **[Read the mathematics](https://datarichinsightpoor.github.io/encounter-check/methods.html):** equations, units, derivations, numerical method, boundaries and references. The same contract is in [web/MATH.md](web/MATH.md).
- **[Inspect the engine](https://github.com/dataRichinsightPoor/encounter-check/blob/main/web/model.js):** original dependency-free JavaScript.
- **[Use the versioned release](https://github.com/dataRichinsightPoor/encounter-check/releases/tag/v0.2.0-alpha):** fixed source snapshot and release notes.

## What it computes

- A mass-action model with free cells, conjugates, a kill probability per conjugate, optional post-kill refractory time or single-use effectors, and first-order background death, integrated with adaptive Dormand–Prince 5(4).
- Fixed-ratio density spread, local density elasticity, and an effector × target heatmap on which a sufficient ratio would show constant color along each diagonal.
- Initial-condition indices: encounter rates, handling time, search fraction \(S=1/(1+b_0h)\), steady kills per effector, and encounter and handling ceilings.
- A geometry test that matches settled (bottom area) and bulk (medium volume) hypotheses at the reference well, then asks what a volume or plate-format change should do. Stokes settling time and footprint coverage are reported alongside.
- A redesign comparison for scarce targets: keep the ratio, keep the effector count, or keep both densities by scaling the well.
- An identifiability check: a rival with more frequent contacts and a re-solved, lower kill probability reproduces reference lysis within 0.9 points, while holding 1.5 times as many targets in conjugates at 1 h.
- A 96-well plate map that crosses ratio, target count and volume, with predictions under both matched geometries.
- An optional bispecific bridge: equilibrium mass balance for free drug, a normalized bridge index \(B=D(\sqrt{K_T}+\sqrt{K_E})^2/((D+K_T)(D+K_E))\), kill probability \(p_{max}(1-e^{-sB})\), dose response at three densities with and without drug bound by cells, free and total EC50, a contact-versus-depletion decomposition, and a volume probe that moves depletion without moving settled contact.
- Exports: time-course and dose figures (PNG), time-course, dose-response and plate-map CSV, and scenario JSON with import.

## Files

- `web/index.html`, `web/app.js`, `web/style.css`: the interface.
- `web/model.js`: the engine. Pure functions, no dependencies.
- `web/MATH.md` and `web/methods.html`: the mathematical contract, derivations and references.
- `tests/model.test.js`: 38 tests covering conservation, analytic limits, exact scaling identities, matched geometries, default numbers, identifiability, Stokes settling, plate layout, validation and exports.
- `tests/drug.test.js`: 20 tests covering the mass balance, bridge-index maximum and symmetry, the EC50 identity, the no-drug limit, depletion scaling with volume, default drug numbers, the plate dose axis and exports.

Run the tests with Node 20 or later:

```
npm test
```

Serve `web/` with any static server to use the tool locally. Verification details are in `VERIFICATION.md`.

## Boundaries

All presets are synthetic. Rate constants are declared, not fitted. There is no confidence coverage, no power calculation and no cost weighting. The model excludes proliferation, activation delay, exhaustion, cytokines, multicellular conjugates, cooperative killing, heterogeneity and aggregated contact. The drug step assumes monovalent equilibrium binding fixed at time zero, no cooperativity or avidity, no internalization or soluble antigen, and no drug consumption by killing. Software verification is not biological validation. The code is original; the public foundations are cited in `web/MATH.md`.

## License

MIT. See `LICENSE`.

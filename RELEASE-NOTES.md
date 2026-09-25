# Encounter Check v0.2.0-alpha: release notes

No. 05 in 99 Small Problems. First public research-use alpha. Version 0.1.0-alpha was a private preview and was never published; its notes are kept below for the development record.

## What changed

A bispecific drug now links effector to target, so dose and density interact.

- Optional drug step (04 in the form). Monovalent equilibrium binding to antigen and effector-receptor pools, free drug solved from the mass balance by bisection, and a normalized bridge index that peaks at free drug \(\sqrt{K_TK_E}\). The kill probability per conjugate becomes \(p_{max}(1-e^{-sB})\). Contact equations are unchanged.
- New section, Discriminating experiment 3: dose response at three densities with and without drug bound by cells, plateau, free and total EC50, drug on cells at EC50, free fraction and lysis at the declared dose, a contact-versus-depletion decomposition, and a volume probe.
- Drug indices in the indices table; the contact rival reports its kill probability at the declared dose.
- Plate map gains a dose axis and free-fraction column when the drug is on.
- New exports: dose figure PNG and dose-response CSV.
- New synthetic preset: "Same ratio, same dose."
- Math contract gains a bridge section with two new references (Douglass et al. 2013; Schropp et al. 2019).

## Synthetic default results (bispecific preset)

At 1:1 in a 32 mm², 100 µL settled well over 4 h, across 0.5×, 1× and 2× density: plateau 27.7%, 40.5% and 53.5%. Free EC50 1.72, 1.60 and 1.47 pM. Total EC50 2.94, 3.89 and 5.74 pM. At 5 pM total, free fraction 61%, 42% and 25%, and lysis 18.4%, 23.5% and 24.5%. Halving the medium at fixed cells and concentration lowers lysis from 23.5% to 17.6% with binding and leaves it at 32.5% without.

## Verification

58 of 58 tests pass. Browser QA at 1360 and 375 px in dark and light themes; no console errors. See `VERIFICATION.md`.

---

# Encounter Check v0.1.0-alpha: development notes

Private preview; not published.

## Question

Two co-cultures share an effector-to-target ratio. Do they share an experiment?

## In this release

- Mass-action engine with conjugates, per-conjugate kill probability, serial killing with refractory time or single-use effectors, and background death. Adaptive Dormand–Prince 5(4) integration at tolerance 1e-9.
- Fixed-ratio density scan with spread and local elasticity, and an effector × target lysis heatmap with iso-ratio diagonals.
- Initial-condition indices including search fraction, steady kill rate and two ceilings. The single-use ceiling is min(1, E/T): failed contacts can be retried, so the kill probability sets the approach, not the limit.
- Matched settled and bulk geometry hypotheses, with volume and plate-format perturbations, Stokes settling estimate and footprint-coverage flag.
- Scarce-target redesign comparison.
- Identifiability check with bisection re-solve of the rival kill probability.
- 96-well plate map builder with CSV export.
- PNG, CSV and JSON exports; JSON import; stale-input state pauses exports until the check is rerun.
- Methods page and Markdown contract with derivations and seven references.

## Synthetic default results

At 1:1 in a 32 mm², 100 µL settled well over 4 h: lysis 28.1%, 41.1% and 54.2% at 5,000, 10,000 and 20,000 of each cell type. Search fraction 0.44. Halving volume leaves settled lysis at 41.1% and raises bulk lysis to 54.2%. With half the targets, keeping the ratio gives 28.1% and scaling the well reproduces 41.1% exactly. The contact rival (k × 2, p* = 0.344) matches lysis within 0.9 points and holds 35.8% against 24.1% of targets in conjugates at 1 h.

## Verification

38 of 38 tests pass. Browser QA at 1360 and 375 px in dark and light themes; no console errors. See `VERIFICATION.md`.

## Boundaries

Synthetic presets only. No confidence coverage, power or cost weighting. Software verification is not biological validation.

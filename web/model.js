// Encounter Check · No. 05 · 99 Small Problems · Data-Rich, Insight-Poor
// A well-mixed, short-window effector–target encounter and killing model.
// Original code, MIT license. All presets are synthetic.
//
// State, in cells per well:
//   Ef free effectors, Tf free live targets, C effector–target conjugates,
//   R refractory effectors after a kill, Dk effector-killed targets,
//   Db targets lost to background death, N cumulative encounters.
// Encounter flux J = k·Ef·Tf/G, where G is the contact scale: the medium
// volume V (bulk hypothesis, k in µL/h) or the well-bottom area A
// (settled hypothesis, k in mm²/h). The scaling is a model assumption.
//
// Optional bispecific bridge (v0.2): a drug with one arm for a target antigen
// (K_T) and one for an effector receptor (K_E) sets the kill probability per
// conjugate, p = p_max·(1 − exp(−s·B)), where B is the normalized ternary-bridge
// index at the free drug concentration. Free drug is solved from a well-wide
// mass balance over both cell-surface pools, which is where cell density enters
// dose–response a second time. Binding is quasi-static at time zero.

export const VERSION = '0.2.1-alpha';
export const FOOTPRINT_LIMIT = 0.25;

export const AVOGADRO = 6.02214076e23;
const NO_DRUG = {drug: 'none', conc: 5, KT: 0.01, KE: 50, RT: 100000, RE: 50000, trigger: 4, depletion: 'on', doseLow: 0.01, doseHigh: 1e6};

const PRESETS = {
  density: {
    label: 'Same 1:1 ratio. Fourfold density span.',
    geometry: 'settled', E: 10000, T: 10000, volume: 100, area: 32, window: 4, readTime: 1,
    k: 0.002, tauC: 1, p: 0.5, killMode: 'serial', tauR: 2, kbg: 0.01, diameter: 10,
    densityLow: 0.5, densityHigh: 2, volumeFactor: 0.5, areaFactor: 0.175, newTargets: 5000, altFactor: 2, ...NO_DRUG,
    plate: {ratios: [0.25, 1, 4], targets: [5000, 10000, 20000], volumes: [100, 200], replicates: 2}
  },
  volume: {
    label: 'Half the medium. Same cells. Which geometry?',
    geometry: 'settled', E: 10000, T: 10000, volume: 200, area: 32, window: 4, readTime: 1,
    k: 0.002, tauC: 1, p: 0.5, killMode: 'serial', tauR: 2, kbg: 0.01, diameter: 10,
    densityLow: 0.5, densityHigh: 2, volumeFactor: 0.5, areaFactor: 0.175, newTargets: 5000, altFactor: 2, ...NO_DRUG,
    plate: {ratios: [1], targets: [5000, 10000, 20000], volumes: [100, 200], replicates: 3}
  },
  saturated: {
    label: 'When the ratio is nearly enough.',
    geometry: 'settled', E: 5000, T: 20000, volume: 100, area: 32, window: 4, readTime: 1,
    k: 0.02, tauC: 1, p: 0.5, killMode: 'serial', tauR: 2, kbg: 0.01, diameter: 10,
    densityLow: 0.5, densityHigh: 2, volumeFactor: 0.5, areaFactor: 0.175, newTargets: 10000, altFactor: 2, ...NO_DRUG,
    plate: {ratios: [0.25, 0.5, 1], targets: [10000, 20000, 40000], volumes: [100], replicates: 2}
  },
  bispecific: {
    label: 'Same ratio, same dose. The plateau doubles; the dose response barely moves.',
    geometry: 'settled', E: 10000, T: 10000, volume: 100, area: 32, window: 4, readTime: 1,
    k: 0.002, tauC: 1, p: 0.5, killMode: 'serial', tauR: 2, kbg: 0.01, diameter: 10,
    densityLow: 0.5, densityHigh: 2, volumeFactor: 0.5, areaFactor: 0.175, newTargets: 5000, altFactor: 2, ...NO_DRUG, drug: 'bridged',
    plate: {ratios: [1], targets: [5000, 10000, 20000], volumes: [100, 200], doses: [1, 5, 25], replicates: 2}
  },
  single: {
    label: 'Single-use effectors turn the ratio into a ceiling.',
    geometry: 'settled', E: 5000, T: 10000, volume: 100, area: 32, window: 24, readTime: 1,
    k: 0.002, tauC: 1, p: 0.8, killMode: 'single', tauR: 2, kbg: 0.005, diameter: 10,
    densityLow: 0.5, densityHigh: 2, volumeFactor: 0.5, areaFactor: 0.175, newTargets: 5000, altFactor: 2, ...NO_DRUG,
    plate: {ratios: [0.25, 0.5, 1], targets: [5000, 10000, 20000], volumes: [100], replicates: 2}
  }
};

export const PRESET_NAMES = Object.keys(PRESETS);
export function presetLabel(name) { return PRESETS[name].label; }
export function preset(name = 'density') {
  if (!PRESETS[name]) throw new Error(`Unknown preset: ${name}`);
  const {label, ...c} = structuredClone(PRESETS[name]);
  return c;
}

const finite = (v, name, lo, hi, {openLo = false} = {}) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name} must be a finite number.`);
  if (openLo ? v <= lo : v < lo) throw new Error(`${name} must be ${openLo ? 'greater than' : 'at least'} ${lo}.`);
  if (v > hi) throw new Error(`${name} must be at most ${hi}.`);
};

export function validate(c) {
  if (!c || typeof c !== 'object') throw new Error('Scenario must be an object.');
  if (!['settled', 'bulk'].includes(c.geometry)) throw new Error('Geometry must be settled or bulk.');
  if (!['serial', 'single'].includes(c.killMode)) throw new Error('Kill mode must be serial or single.');
  finite(c.E, 'Effector cells', 0, 1e8);
  finite(c.T, 'Target cells', 0, 1e8, {openLo: true});
  finite(c.volume, 'Medium volume', 0, 1e5, {openLo: true});
  finite(c.area, 'Well-bottom area', 0, 1e5, {openLo: true});
  finite(c.window, 'Assay window', 0, 720, {openLo: true});
  finite(c.readTime, 'Contact read time', 0, c.window);
  finite(c.k, 'Encounter coefficient', 0, 1e6);
  finite(c.tauC, 'Mean conjugate lifetime', 0, 1e4, {openLo: true});
  finite(c.p, 'Kill probability per conjugate', 0, 1);
  finite(c.tauR, 'Post-kill refractory time', 0, 1e4);
  finite(c.kbg, 'Background death rate', 0, 10);
  finite(c.diameter, 'Cell diameter', 0, 1000, {openLo: true});
  finite(c.densityLow, 'Lower density factor', 0, 1, {openLo: true});
  finite(c.densityHigh, 'Upper density factor', 1, 1000);
  finite(c.volumeFactor, 'Volume factor', 0, 100, {openLo: true});
  finite(c.areaFactor, 'Area factor', 0, 100, {openLo: true});
  finite(c.newTargets, 'Available targets', 0, 1e8, {openLo: true});
  finite(c.altFactor, 'Alternative contact factor', 1, 100);
  if (!['none', 'bridged'].includes(c.drug ?? 'none')) throw new Error('Drug mode must be none or bridged.');
  if (c.drug === 'bridged') {
    if (!['on', 'off'].includes(c.depletion)) throw new Error('Drug depletion must be on or off.');
    finite(c.conc, 'Drug concentration', 0, 1e9);
    finite(c.KT, 'Target-arm KD', 0, 1e6, {openLo: true});
    finite(c.KE, 'Effector-arm KD', 0, 1e6, {openLo: true});
    finite(c.RT, 'Antigens per target cell', 0, 1e8);
    finite(c.RE, 'Receptors per effector cell', 0, 1e8);
    finite(c.trigger, 'Trigger strength', 0, 1000, {openLo: true});
    finite(c.doseLow, 'Lowest curve dose', 0, 1e9, {openLo: true});
    finite(c.doseHigh, 'Highest curve dose', c.doseLow * 10, 1e10);
  }
  return c;
}

export const scale = c => c.geometry === 'settled' ? c.area : c.volume;
export const units = c => c.geometry === 'settled'
  ? {scale: 'mm²', k: 'mm²/h', density: 'cells/mm²'}
  : {scale: 'µL', k: 'µL/h', density: 'cells/µL'};

// ---- Drug bridge (v0.2) --------------------------------------------------
// Concentrations: conc and dose limits in pM, KT and KE in nM, internally molar.
const PM = 1e-12, NM = 1e-9;
// Molar concentration of binding sites in the well for n cells with r sites each.
export const siteConc = (n, r, volumeUL) => n * r / (AVOGADRO * volumeUL * 1e-6);
export function sitePools(c) {
  return {ST: siteConc(c.T, c.RT, c.volume), SE: siteConc(c.E, c.RE, c.volume)};
}
// Total drug needed to hold free drug at D (molar): D + S_T·θ_T + S_E·θ_E.
export function totalFromFree(c, D) {
  if (c.depletion === 'off') return D;
  const {ST, SE} = sitePools(c), KT = c.KT * NM, KE = c.KE * NM;
  return D + ST * D / (D + KT) + SE * D / (D + KE);
}
// Free drug from total by bisection on the monotone mass balance.
export function freeDrug(c, total = c.conc * PM) {
  if (total <= 0) return 0;
  if (c.depletion === 'off') return total;
  let lo = 0, hi = total;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (totalFromFree(c, mid) > total) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
// Normalized ternary-bridge index. With surface cross-linking constants
// proportional to the solution affinities and no cooperativity, bridges scale as
// D/((D+K_T)(D+K_E)); B equals 1 at D* = √(K_T·K_E).
export function bridgeIndex(c, D) {
  const KT = c.KT * NM, KE = c.KE * NM, r = Math.sqrt(KT) + Math.sqrt(KE);
  return D * r * r / ((D + KT) * (D + KE));
}
export const peakFree = c => Math.sqrt(c.KT * c.KE) * NM;
export const killFromBridge = (c, B) => c.p * (1 - Math.exp(-c.trigger * B));
// Effective kill probability per conjugate used by the rate equations.
export function effectiveP(c) {
  if (c.drug !== 'bridged') return c.p;
  return killFromBridge(c, bridgeIndex(c, freeDrug(c)));
}
export function drugState(c) {
  if (c.drug !== 'bridged') return null;
  const total = c.conc * PM, D = freeDrug(c, total), {ST, SE} = sitePools(c);
  const KT = c.KT * NM, KE = c.KE * NM, B = bridgeIndex(c, D);
  return {
    total, free: D, freeFraction: total > 0 ? D / total : 1,
    thetaT: D / (D + KT), thetaE: D / (D + KE), ST, SE, bridge: B,
    pEff: killFromBridge(c, B), pPeak: killFromBridge(c, 1),
    peakFree: peakFree(c), peakTotal: totalFromFree(c, peakFree(c))
  };
}

// Right-hand side. y = [Ef, Tf, C, R, Dk, Db, N].
function rhs(c) {
  const pe = effectiveP(c);
  const G = scale(c), kill = pe / c.tauC, off = (1 - pe) / c.tauC, bg = c.kbg;
  const single = c.killMode === 'single', instant = !single && c.tauR === 0;
  const rec = single || instant ? 0 : 1 / c.tauR;
  return (t, y, d) => {
    const [Ef, Tf, C, R] = y;
    const J = c.k * Ef * Tf / G;
    const toFree = instant ? kill * C : rec * R;
    d[0] = -J + (off + bg) * C + toFree;
    d[1] = -J + off * C - bg * Tf;
    d[2] = J - (off + kill + bg) * C;
    d[3] = instant ? 0 : kill * C - rec * R;
    d[4] = kill * C;
    d[5] = bg * (Tf + C);
    d[6] = J;
  };
}

// Dormand–Prince 5(4) with adaptive steps, landing exactly on each output time.
const A = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]];
const CT = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

export function integrate(f, y0, times, {rtol = 1e-9, atol = 1e-9, maxSteps = 200000} = {}) {
  const n = y0.length, K = Array.from({length: 7}, () => new Float64Array(n));
  let y = Float64Array.from(y0), t = 0, h = Math.max(1e-6, (times.at(-1) || 1) / 1000), steps = 0;
  const out = [], tmp = new Float64Array(n), y5 = new Float64Array(n);
  for (const target of times) {
    while (t < target - 1e-14 * Math.max(1, target)) {
      if (++steps > maxSteps) throw new Error('Integration did not converge; check for extreme rates.');
      const hh = Math.min(h, target - t);
      for (let s = 0; s < 7; s++) {
        for (let i = 0; i < n; i++) {
          let acc = y[i];
          for (let j = 0; j < s; j++) acc += hh * A[s][j] * K[j][i];
          tmp[i] = acc;
        }
        f(t + CT[s] * hh, tmp, K[s]);
      }
      let err = 0;
      for (let i = 0; i < n; i++) {
        let a5 = y[i], a4 = y[i];
        for (let s = 0; s < 7; s++) { a5 += hh * B5[s] * K[s][i]; a4 += hh * B4[s] * K[s][i]; }
        y5[i] = a5;
        const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(a5));
        err = Math.max(err, Math.abs(a5 - a4) / sc);
      }
      if (err <= 1) {
        t += hh; y.set(y5);
        for (let i = 0; i < n; i++) if (y[i] < 0 && y[i] > -1e-9 * Math.max(1, y0[i] || 1)) y[i] = 0;
      }
      h = hh * Math.min(5, Math.max(0.2, 0.9 * (err === 0 ? 5 : err ** -0.2)));
    }
    out.push(Array.from(y));
  }
  return out;
}

function describe(c, t, y) {
  const [Ef, Tf, C, R, Dk, Db, N] = y;
  const ctrl = c.T * (1 - Math.exp(-c.kbg * t));
  const denom = c.T - ctrl;
  return {
    time: t, freeEffectors: Ef, freeTargets: Tf, conjugates: C, refractory: R, killed: Dk, background: Db, encounters: N,
    lysis: Dk / c.T,
    liveTargets: (Tf + C) / c.T,
    specificLysis: denom > 0 ? (Dk + Db - ctrl) / denom : NaN,
    conjugatedTargets: C / c.T,
    engagedEffectors: c.E > 0 ? C / c.E : 0,
    encountersPerTarget: N / c.T,
    killsPerEffector: c.E > 0 ? Dk / c.E : 0
  };
}

export function simulate(c, {points = 121, extra = []} = {}) {
  validate(c);
  const grid = Array.from({length: points}, (_, i) => c.window * i / (points - 1));
  const times = [...new Set([...grid, c.readTime, ...extra.filter(x => x >= 0 && x <= c.window)])].sort((a, b) => a - b);
  const ys = integrate(rhs(c), [c.E, c.T, 0, 0, 0, 0, 0], times);
  const rows = times.map((t, i) => describe(c, t, ys[i]));
  const at = t => rows.find(r => Math.abs(r.time - t) < 1e-12) ?? interpolate(rows, t);
  return {rows, at, end: rows.at(-1), read: at(c.readTime)};
}

function interpolate(rows, t) {
  let i = rows.findIndex(r => r.time >= t);
  if (i <= 0) return rows[Math.max(0, i)];
  const a = rows[i - 1], b = rows[i], w = (t - a.time) / (b.time - a.time), o = {};
  for (const k of Object.keys(a)) o[k] = a[k] + w * (b[k] - a[k]);
  return o;
}

// Lysis at the end of the window only, for scans.
export function endpoint(c) {
  const ys = integrate(rhs(c), [c.E, c.T, 0, 0, 0, 0, 0], c.readTime < c.window ? [c.readTime, c.window] : [c.window]);
  return {read: describe(c, c.readTime, ys[0]), end: describe(c, c.window, ys.at(-1))};
}

// Initial-condition indices; they describe t = 0, not the whole window.
export function indices(c) {
  validate(c);
  const G = scale(c);
  const a0 = c.k * c.E / G, b0 = c.k * c.T / G;
  const pe = effectiveP(c);
  const handling = c.killMode === 'single' ? Infinity : c.tauC + pe * c.tauR;
  const search = b0 > 0 ? 1 / b0 : Infinity;
  const searchFraction = c.killMode === 'single' ? NaN : (b0 === 0 ? 1 : 1 / (1 + b0 * handling));
  const coverage = (c.E + c.T) * Math.PI * (c.diameter / 2000) ** 2 / c.area;
  return {
    ratio: c.E / c.T, effectorDensity: c.E / G, targetDensity: c.T / G,
    perTargetRate: a0, perEffectorRate: b0, handling, searchTime: search, searchFraction,
    conjugateFree: 1 / (1 + a0 * c.tauC), coverage, crowded: coverage > FOOTPRINT_LIMIT,
    encounterAsymptote: 1 - Math.exp(-pe * a0 * c.window),
    handlingAsymptote: c.killMode === 'single' ? Math.min(1, c.E / c.T) : Math.min(1, (c.E / c.T) * (pe / handling) * c.window),
    steadyKillRate: c.killMode === 'single' || b0 === 0 ? 0 : pe / (search + handling)
  };
}

const scaled = (c, f) => ({...c, E: c.E * f, T: c.T * f});

// Fixed ratio, fixed well: multiply both counts.
export function densityScan(c, factors) {
  validate(c);
  const fs = factors ?? logSpace(c.densityLow, c.densityHigh, 9);
  const rows = fs.map(f => ({factor: f, E: c.E * f, T: c.T * f, ...pick(endpoint(scaled(c, f)))}));
  const lo = endpoint(scaled(c, c.densityLow)).end.lysis, hi = endpoint(scaled(c, c.densityHigh)).end.lysis;
  const ref = endpoint(c).end.lysis;
  const d = 1.02, up = endpoint(scaled(c, d)).end.lysis, dn = endpoint(scaled(c, 1 / d)).end.lysis;
  const elasticity = ref > 0 && up > 0 && dn > 0 ? Math.log(up / dn) / Math.log(d * d) : NaN;
  return {rows, low: lo, high: hi, reference: ref, spread: hi - lo, elasticity};
}
const pick = r => ({lysis: r.end.lysis, specificLysis: r.end.specificLysis, conjugatedAtRead: r.read.conjugatedTargets, encountersPerTarget: r.end.encountersPerTarget});

export function logSpace(a, b, n) {
  if (n === 1) return [a];
  return Array.from({length: n}, (_, i) => a * (b / a) ** (i / (n - 1)));
}

// Geometry discrimination. The alternative hypothesis is matched to the nominal
// one at the reference well (equal per-target encounter rate), then both are
// asked to predict a volume change and an area change at fixed cell counts.
export function matchedAlternative(c) {
  const alt = c.geometry === 'settled' ? 'bulk' : 'settled';
  const k = c.k * scale({...c, geometry: alt}) / scale(c);
  return {...c, geometry: alt, k};
}
export function geometryTest(c) {
  validate(c);
  const alt = matchedAlternative(c);
  const hyp = {[c.geometry]: c, [alt.geometry]: alt};
  const row = (label, change) => {
    const o = {label};
    for (const g of ['settled', 'bulk']) o[g] = endpoint({...hyp[g], ...change(hyp[g])}).end.lysis;
    o.separation = Math.abs(o.settled - o.bulk);
    o.coverage = indices({...c, ...change(c)}).coverage;
    return o;
  };
  const rows = [
    row('Reference well', () => ({})),
    row(`Medium volume × ${fmt(c.volumeFactor)}`, h => ({volume: h.volume * c.volumeFactor})),
    row(`Bottom area × ${fmt(c.areaFactor)}`, h => ({area: h.area * c.areaFactor}))
  ];
  return {alternative: alt, rows};
}
const fmt = x => Number(x.toPrecision(3)).toString();

// Fewer (or more) targets available. Three ways to rebuild the reference well.
export function redesign(c) {
  validate(c);
  const f = c.newTargets / c.T, ref = endpoint(c).end;
  const options = [
    {id: 'ratio', label: 'Keep the E:T ratio in the same well', change: {E: c.E * f, T: c.newTargets}},
    {id: 'effector', label: 'Keep the effector count in the same well', change: {T: c.newTargets}},
    {id: 'density', label: 'Keep both densities: scale the well', change: {E: c.E * f, T: c.newTargets, volume: c.volume * f, area: c.area * f}}
  ].map(o => {
    const s = {...c, ...o.change}, r = endpoint(s).end;
    return {...o, E: s.E, T: s.T, volume: s.volume, area: s.area, ratio: s.E / s.T, lysis: r.lysis, deviation: r.lysis - ref.lysis,
      coverage: indices(s).coverage};
  });
  return {reference: ref.lysis, factor: f, options};
}

// Lysis alone cannot separate contact frequency from per-contact kill probability.
// Alternative: k × m, with the kill probability re-solved so that both hypotheses
// give the same lysis at the reference well and the same conjugate lifetime.
export function matchKillProbability(c, k) {
  const target = endpoint(c).end.lysis, f = p => endpoint({...c, k, p}).end.lysis - target;
  if (target === 0) return 0;
  if (f(1) < 0) return NaN;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function identifiability(c) {
  validate(c);
  const k = c.k * c.altFactor, p = matchKillProbability(c, k);
  if (!Number.isFinite(p)) throw new Error('No kill probability reproduces the reference lysis with the alternative contact rate.');
  const alt = {...c, k, p};
  const a = simulate(c, {points: 81}), b = simulate(alt, {points: 81});
  const span = [c.densityLow, 1, c.densityHigh].map(f => {
    const x = endpoint(scaled(c, f)), y = endpoint(scaled(alt, f));
    return {factor: f, lysisA: x.end.lysis, lysisB: y.end.lysis, conjA: x.read.conjugatedTargets, conjB: y.read.conjugatedTargets};
  });
  const maxLysisGap = Math.max(...a.rows.map((r, i) => Math.abs(r.lysis - b.rows[i].lysis)));
  return {alternative: alt, a, b, span, maxLysisGap, pEffRef: effectiveP(c), pEffAlt: effectiveP(alt),
    conjugateRatio: a.read.conjugatedTargets > 0 ? b.read.conjugatedTargets / a.read.conjugatedTargets : NaN};
}

// Effector density × target density map at the reference well.
export function densityMap(c, n = 17, span = 4) {
  validate(c);
  const fs = logSpace(1 / span, span, n), cells = [];
  for (const fe of fs) for (const ft of fs) {
    const s = {...c, E: c.E * fe, T: c.T * ft};
    const r = endpoint(s).end;
    cells.push({fe, ft, E: s.E, T: s.T, lysis: r.lysis});
  }
  return {factors: fs, n, cells};
}

// ---- Dose–response under the bridge -------------------------------------
// Lysis depends on drug only through the free concentration, so every curve can
// be evaluated at a free dose and mapped to a total dose by the mass balance.
export function lysisAtFree(c, D) {
  return endpoint({...c, drug: 'bridged', depletion: 'off', conc: D / PM}).end.lysis;
}
function bisectLog(f, lo, hi, iters = 36) {
  let a = Math.log(lo), b = Math.log(hi);
  const fa = f(lo);
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if ((f(Math.exp(m)) > 0) === (fa > 0)) a = m; else b = m;
  }
  return Math.exp((a + b) / 2);
}
// Half-maximal free doses on both limbs of the bell, relative to this well's own
// maximum, which occurs at B = 1, i.e. at free D* = √(K_T·K_E).
export function potency(c) {
  const Ds = peakFree(c), emax = lysisAtFree(c, Ds), half = emax / 2;
  if (!(emax > 0)) return {emax, ec50Free: NaN, ec50Total: NaN, hookFree: NaN, hookTotal: NaN};
  const g = D => lysisAtFree(c, D) - half;
  const ec50Free = bisectLog(g, Ds * 1e-9, Ds);
  const hookFree = bisectLog(g, Ds, Ds * 1e9);
  return {emax, ec50Free, ec50Total: totalFromFree(c, ec50Free), hookFree, hookTotal: totalFromFree(c, hookFree),
    peakFree: Ds, peakTotal: totalFromFree(c, Ds)};
}
export function doseResponse(c, {n = 41} = {}) {
  validate(c);
  if (c.drug !== 'bridged') return null;
  const factors = [c.densityLow, 1, c.densityHigh];
  const doses = logSpace(c.doseLow, c.doseHigh, n);
  const curves = factors.map(f => {
    const s = scaled(c, f);
    return {factor: f, E: s.E, T: s.T,
      withDepletion: doses.map(d => lysisAtFree(s, freeDrug({...s, depletion: 'on'}, d * PM))),
      freeEqualsTotal: doses.map(d => lysisAtFree(s, d * PM))};
  });
  const rows = factors.map(f => {
    const s = scaled(c, f), on = {...s, depletion: 'on'}, pot = potency(on), ref = freeDrug(on);
    return {factor: f, E: s.E, T: s.T, ...pot, bound: pot.ec50Total - pot.ec50Free,
      freeFractionAtDose: c.conc > 0 ? ref / (c.conc * PM) : 1,
      lysisAtDose: endpoint({...s, depletion: c.depletion}).end.lysis};
  });
  const lo = rows[0], hi = rows[2], L = Math.log10;
  const contactShift = L(hi.ec50Free / lo.ec50Free), totalShift = L(hi.ec50Total / lo.ec50Total);
  // Same cells, same total concentration, volume changed: the probe that moves
  // depletion without moving settled contact.
  const v = {...c, volume: c.volume * c.volumeFactor}, von = {...v, depletion: 'on'};
  const refOn = {...c, depletion: 'on'};
  const probe = {
    factor: c.volumeFactor, geometry: c.geometry,
    lysisRef: endpoint(refOn).end.lysis, lysisVol: endpoint(von).end.lysis,
    lysisRefNoDep: endpoint({...c, depletion: 'off'}).end.lysis, lysisVolNoDep: endpoint({...v, depletion: 'off'}).end.lysis,
    ec50Ref: rows[1].ec50Total, ec50Vol: potency(von).ec50Total
  };
  return {doses, curves, rows, contactShift, totalShift, depletionShift: totalShift - contactShift,
    foldTotal: hi.ec50Total / lo.ec50Total, foldFree: hi.ec50Free / lo.ec50Free, probe};
}

// Stokes settling of a single sphere through the medium height H = V / A.
export function settling(c, {densityDiff = 50, viscosity = 0.78e-3} = {}) {
  const r = c.diameter / 2 * 1e-6, v = 2 / 9 * densityDiff * 9.81 * r * r / viscosity; // m/s
  const height = c.volume / c.area; // µL/mm² = mm
  const seconds = height * 1e-3 / v;
  return {height, velocity: v * 1e6, minutes: seconds / 60, fractionOfWindow: seconds / 3600 / c.window};
}

// Factorial plate map: ratio × target count × volume × replicate, in 96-well order.
export function plateMap(c, spec = c.plate) {
  validate(c);
  const {ratios, targets, volumes, replicates} = spec;
  for (const [n, a] of Object.entries({ratios, targets, volumes})) {
    if (!Array.isArray(a) || !a.length || a.some(x => !(Number.isFinite(x) && x > 0))) throw new Error(`Plate ${n} must be positive numbers.`);
  }
  if (!Number.isInteger(replicates) || replicates < 1 || replicates > 12) throw new Error('Replicates must be an integer from 1 to 12.');
  const drug = c.drug === 'bridged';
  const doses = drug ? (spec.doses?.length ? spec.doses : [c.conc]) : [null];
  if (drug && doses.some(x => !(Number.isFinite(x) && x >= 0))) throw new Error('Plate doses must be non-negative numbers.');
  const alt = matchedAlternative(c), hyp = {[c.geometry]: c, [alt.geometry]: alt};
  const conditions = [];
  for (const dose of doses) for (const v of volumes) for (const t of targets) for (const q of ratios) {
    const base = {E: q * t, T: t, volume: v, ...(drug ? {conc: dose} : {})};
    const s = endpoint({...hyp.settled, ...base}), b = endpoint({...hyp.bulk, ...base});
    const ix = indices({...c, ...base});
    conditions.push({ratio: q, E: q * t, T: t, volume: v, dose: drug ? dose : '', freeFraction: drug ? drugState({...c, ...base}).freeFraction : '', settled: s.end.lysis, bulk: b.end.lysis,
      conjugated: (c.geometry === 'settled' ? s : b).read.conjugatedTargets, searchFraction: ix.searchFraction, coverage: ix.coverage, crowded: ix.crowded});
  }
  const total = conditions.length * replicates;
  if (total > 96) throw new Error(`The design needs ${total} wells; a 96-well plate holds 96. Reduce levels or replicates.`);
  const wells = [];
  let i = 0;
  conditions.forEach((d, j) => { for (let r = 0; r < replicates; r++, i++) wells.push({well: 'ABCDEFGH'[Math.floor(i / 12)] + (i % 12 + 1), condition: j + 1, replicate: r + 1, ...d}); });
  return {conditions, wells, total};
}

// Exports.
const q = x => {
  if (typeof x === 'number') return Number.isFinite(x) ? Number(x.toPrecision(8)) : '';
  const s = String(x);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
export function timeCsv(c) {
  const r = simulate(c);
  const cols = ['time', 'freeEffectors', 'freeTargets', 'conjugates', 'refractory', 'killed', 'background', 'encounters', 'lysis', 'specificLysis', 'conjugatedTargets', 'engagedEffectors'];
  return [`# Encounter Check ${VERSION} · synthetic or user-declared inputs · geometry=${c.geometry}${c.drug === 'bridged' ? ` · drug=${c.conc} pM total · effective p=${q(effectiveP(c))}` : ''}`, cols.join(','), ...r.rows.map(row => cols.map(k => q(row[k])).join(','))].join('\n') + '\n';
}
export function plateCsv(c) {
  const p = plateMap(c);
  const cols = ['well', 'condition', 'replicate', 'ratio', 'E', 'T', 'volume', ...(c.drug === 'bridged' ? ['dose', 'freeFraction'] : []), 'settled', 'bulk', 'conjugated', 'searchFraction', 'coverage', 'crowded'];
  return [`# Encounter Check ${VERSION} plate map · predicted effector-attributed lysis at ${c.window} h under matched settled and bulk hypotheses${c.drug === 'bridged' ? ' · dose in pM total' : ''}`, cols.join(','), ...p.wells.map(w => cols.map(k => q(typeof w[k] === 'boolean' ? String(w[k]) : w[k])).join(','))].join('\n') + '\n';
}
export function doseCsv(c) {
  const r = doseResponse(c);
  if (!r) throw new Error('Dose response needs the bispecific bridge switched on.');
  const cols = ['dosePM'];
  for (const cv of r.curves) cols.push(`lysis_depletion_x${q(cv.factor)}`, `lysis_freeEqualsTotal_x${q(cv.factor)}`);
  const lines = r.doses.map((d, i) => [q(d), ...r.curves.flatMap(cv => [q(cv.withDepletion[i]), q(cv.freeEqualsTotal[i])])].join(','));
  return [`# Encounter Check ${VERSION} dose response · effector-attributed lysis at ${c.window} h · fixed E:T ${q(c.E / c.T)} · density factors applied to both cell counts`, cols.join(','), ...lines].join('\n') + '\n';
}
export function pack(c) { return JSON.stringify({tool: 'encounter-check', version: VERSION, scenario: c}, null, 2); }
export function unpack(text) {
  const o = JSON.parse(text);
  if (o.tool !== 'encounter-check' || !o.scenario) throw new Error('Not an Encounter Check scenario file.');
  const c = {...preset(), ...o.scenario, plate: {...preset().plate, ...(o.scenario.plate || {})}};
  return validate(c);
}

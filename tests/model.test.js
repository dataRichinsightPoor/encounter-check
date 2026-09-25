import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../web/model.js';

const near = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);
const base = (o = {}) => ({...m.preset(), ...o});

test('every preset validates and runs', () => {
  for (const n of m.PRESET_NAMES) {
    const c = m.preset(n);
    assert.ok(m.presetLabel(n).length > 10);
    const r = m.simulate(c);
    assert.ok(r.end.lysis >= 0 && r.end.lysis <= 1);
  }
});

test('preset returns an independent copy', () => {
  const a = m.preset(); a.plate.ratios.push(99); a.E = 1;
  assert.equal(m.preset().E, 10000);
  assert.deepEqual(m.preset().plate.ratios, [0.25, 1, 4]);
});

test('unknown preset is rejected', () => assert.throws(() => m.preset('nope'), /Unknown preset/));

test('cell and effector conservation hold throughout', () => {
  for (const n of m.PRESET_NAMES) {
    const c = m.preset(n);
    for (const r of m.simulate(c).rows) {
      near(r.freeEffectors + r.conjugates + r.refractory, c.E, 1e-5 * c.E + 1e-6);
      near(r.freeTargets + r.conjugates + r.killed + r.background, c.T, 1e-5 * c.T);
    }
  }
});

test('states remain non-negative', () => {
  for (const n of m.PRESET_NAMES) for (const r of m.simulate(m.preset(n)).rows) {
    for (const k of ['freeEffectors', 'freeTargets', 'conjugates', 'refractory', 'killed', 'background', 'encounters']) assert.ok(r[k] >= -1e-9, `${k}=${r[k]}`);
  }
});

test('lysis and encounters are monotone in time', () => {
  const rows = m.simulate(base()).rows;
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].lysis >= rows[i - 1].lysis - 1e-12);
    assert.ok(rows[i].encounters >= rows[i - 1].encounters - 1e-9);
  }
});

test('no effectors: only background death, matching the analytic control', () => {
  const c = base({E: 0});
  for (const r of m.simulate(c).rows) {
    near(r.killed, 0, 1e-12);
    near(r.background / c.T, 1 - Math.exp(-c.kbg * r.time), 1e-8);
    near(r.specificLysis, 0, 1e-8);
  }
});

test('zero encounter coefficient kills nothing', () => {
  const r = m.simulate(base({k: 0})).end;
  near(r.killed, 0, 1e-12); near(r.encounters, 0, 1e-12);
});

test('encounter-limited limit: lysis = 1 − exp(−p·k·E/G·t)', () => {
  // Very short conjugates, immediate effector return, no background loss.
  const c = base({tauC: 1e-4, tauR: 0, kbg: 0, window: 6});
  const a = c.p * c.k * c.E / c.area;
  for (const r of m.simulate(c, {points: 13}).rows) near(r.lysis, 1 - Math.exp(-a * r.time), 2e-4);
});

test('encounter-limited lysis does not depend on target count', () => {
  const c = base({tauC: 1e-4, tauR: 0, kbg: 0});
  const x = m.endpoint(c).end.lysis, y = m.endpoint({...c, T: c.T * 8}).end.lysis;
  near(x, y, 5e-4);
});

test('lysis never exceeds the encounter asymptote', () => {
  for (const n of m.PRESET_NAMES) {
    const c = m.preset(n);
    for (const f of [0.25, 1, 4]) {
      const s = {...c, E: c.E * f, T: c.T * f};
      assert.ok(m.endpoint(s).end.lysis <= m.indices(s).encounterAsymptote + 1e-9);
    }
  }
});

test('single-use effectors cannot kill more than E targets', () => {
  const c = base({killMode: 'single', p: 1, kbg: 0, window: 500, k: 0.05, E: 3000, T: 10000});
  const r = m.simulate(c).end;
  assert.ok(r.killed <= c.E + 1e-6);
  near(r.killed, c.E, 1);
});

test('single-use cap with p < 1 approaches min(1, E/T) only through repeated contacts', () => {
  const c = base({killMode: 'single', p: 0.3, kbg: 0, window: 700, k: 0.05, E: 3000, T: 10000});
  near(m.simulate(c).end.killed, 3000, 5);
});

test('steady effector cycle rate in target excess', () => {
  // Targets in vast excess stay near T0, so each effector kills at p / (1/b0 + τc + pτR).
  const c = base({E: 10, T: 1e7, kbg: 0, window: 200, readTime: 150});
  const r = m.simulate(c, {points: 401});
  const rate = (r.end.killed - r.at(150).killed) / 50 / c.E;
  near(rate, m.indices(c).steadyKillRate, 2e-3 * m.indices(c).steadyKillRate);
});

test('exact time–density scaling identity', () => {
  // Multiplying both densities by λ and every first-order rate by λ is equivalent to time × λ.
  const c = base(), L = 3;
  const s = {...c, E: c.E * L, T: c.T * L, tauC: c.tauC / L, tauR: c.tauR / L, kbg: c.kbg * L, window: c.window / L, readTime: c.readTime / L};
  near(m.endpoint(c).end.lysis, m.endpoint(s).end.lysis, 1e-7);
  near(m.endpoint(c).read.conjugatedTargets, m.endpoint(s).read.conjugatedTargets, 1e-7);
});

test('densities, not counts, define the prediction', () => {
  const c = base(), f = 0.37;
  const s = {...c, E: c.E * f, T: c.T * f, area: c.area * f, volume: c.volume * f};
  near(m.endpoint(c).end.lysis, m.endpoint(s).end.lysis, 1e-8);
});

test('settled hypothesis ignores volume; bulk ignores area', () => {
  const c = base();
  near(m.endpoint(c).end.lysis, m.endpoint({...c, volume: 37}).end.lysis, 1e-12);
  const b = {...c, geometry: 'bulk', k: c.k * c.volume / c.area};
  near(m.endpoint(b).end.lysis, m.endpoint({...b, area: 3}).end.lysis, 1e-12);
});

test('matched alternative reproduces the reference well exactly', () => {
  for (const n of m.PRESET_NAMES) {
    const c = m.preset(n), alt = m.matchedAlternative(c);
    assert.notEqual(alt.geometry, c.geometry);
    near(m.endpoint(c).end.lysis, m.endpoint(alt).end.lysis, 1e-9);
    near(m.indices(c).perTargetRate, m.indices(alt).perTargetRate, 1e-12);
  }
});

test('halving volume under the bulk hypothesis equals doubling both counts', () => {
  const c = {...base(), geometry: 'bulk', k: 0.002 * 100 / 32};
  near(m.endpoint({...c, volume: c.volume / 2}).end.lysis, m.endpoint({...c, E: c.E * 2, T: c.T * 2}).end.lysis, 1e-9);
});

test('geometry test: volume change separates hypotheses only through bulk', () => {
  const g = m.geometryTest(base());
  near(g.rows[0].separation, 0, 1e-9);
  near(g.rows[1].settled, g.rows[0].settled, 1e-12);
  assert.ok(g.rows[1].bulk > g.rows[0].bulk + 0.1);
  near(g.rows[2].bulk, g.rows[0].bulk, 1e-12);
  assert.ok(g.rows[2].settled > g.rows[0].settled + 0.2);
});

test('default density hook: 28.1%, 41.1%, 54.2% at fixed 1:1 ratio', () => {
  const d = m.densityScan(base());
  near(d.low, 0.2810, 5e-4); near(d.reference, 0.4110, 5e-4); near(d.high, 0.5424, 5e-4);
  assert.ok(d.elasticity > 0.4 && d.elasticity < 0.55);
});

test('ratio sufficiency emerges when effectors are handling-limited', () => {
  const d = m.densityScan(m.preset('saturated'));
  assert.ok(d.spread < 0.04 && d.elasticity < 0.1);
  assert.ok(m.indices(m.preset('saturated')).searchFraction < 0.05);
});

test('elasticity approaches one in the encounter-limited, low-lysis regime', () => {
  const c = base({tauC: 1e-3, tauR: 0, kbg: 0, k: 1e-5});
  near(m.densityScan(c).elasticity, 1, 0.01);
});

test('search fraction formula', () => {
  const c = base(), ix = m.indices(c);
  near(ix.perEffectorRate, c.k * c.T / c.area, 1e-15);
  near(ix.handling, c.tauC + c.p * c.tauR, 1e-15);
  near(ix.searchFraction, 1 / (1 + ix.perEffectorRate * ix.handling), 1e-15);
  near(ix.searchFraction, 0.4444444444, 1e-9);
});

test('density-preserving redesign reproduces the reference; ratio-preserving does not', () => {
  const r = m.redesign(base());
  const byId = Object.fromEntries(r.options.map(o => [o.id, o]));
  near(byId.density.deviation, 0, 1e-9);
  assert.ok(byId.ratio.deviation < -0.1);
  assert.ok(Math.abs(byId.effector.deviation) < Math.abs(byId.ratio.deviation));
});

test('identifiability: matched lysis at reference, different conjugates', () => {
  const id = m.identifiability(base());
  const ref = id.span.find(s => s.factor === 1);
  near(ref.lysisA, ref.lysisB, 1e-6);
  assert.ok(id.maxLysisGap < 0.015);
  assert.ok(id.conjugateRatio > 1.3);
});

test('matched kill probability lies below the original when contacts increase', () => {
  const c = base(), p = m.matchKillProbability(c, c.k * 2);
  assert.ok(p > 0 && p < c.p);
});

test('specific lysis matches effector-attributed lysis without background death', () => {
  const r = m.simulate(base({kbg: 0})).end;
  near(r.specificLysis, r.lysis, 1e-12);
});

test('settling estimate follows Stokes law', () => {
  const s = m.settling(base());
  near(s.height, 100 / 32, 1e-12);
  const v = 2 / 9 * 50 * 9.81 * (5e-6) ** 2 / 0.78e-3;
  near(s.velocity, v * 1e6, 1e-9);
  near(s.minutes, 3.125e-3 / v / 60, 1e-9);
});

test('coverage flags crowded wells', () => {
  const ix = m.indices(base({E: 200000, T: 200000}));
  assert.ok(ix.coverage > m.FOOTPRINT_LIMIT && ix.crowded);
  assert.equal(m.indices(base()).crowded, false);
});

test('plate map lays out wells in 96-well order', () => {
  const p = m.plateMap(base());
  assert.equal(p.conditions.length, 18); assert.equal(p.total, 36);
  assert.equal(p.wells[0].well, 'A1'); assert.equal(p.wells[11].well, 'A12'); assert.equal(p.wells[12].well, 'B1');
  assert.equal(p.wells.at(-1).well, 'C12');
});

test('plate map rejects designs larger than a plate', () => {
  const c = base(); c.plate = {ratios: [1, 2, 3, 4], targets: [1, 2, 3, 4, 5], volumes: [100, 200, 300], replicates: 2};
  assert.throws(() => m.plateMap(c), /96/);
});

test('plate map matched hypotheses agree at reference-like well', () => {
  const c = base(); c.plate = {ratios: [1], targets: [10000], volumes: [100], replicates: 1};
  const w = m.plateMap(c).wells[0];
  near(w.settled, w.bulk, 1e-9);
});

test('validation rejects impossible inputs', () => {
  assert.throws(() => m.validate(base({p: 1.2})), /Kill probability/);
  assert.throws(() => m.validate(base({T: 0})), /Target/);
  assert.throws(() => m.validate(base({readTime: 10})), /Contact read time/);
  assert.throws(() => m.validate(base({geometry: 'adherent'})), /Geometry/);
  assert.throws(() => m.validate(base({tauC: 0})), /conjugate lifetime/);
  assert.throws(() => m.validate(base({E: NaN})), /finite/);
});

test('scenario JSON round trip', () => {
  const c = base({E: 1234});
  assert.deepEqual(m.unpack(m.pack(c)), c);
  assert.throws(() => m.unpack('{"tool":"other"}'), /Not an Encounter Check/);
});

test('CSV exports are labeled and complete', () => {
  const t = m.timeCsv(base());
  assert.match(t, /^# Encounter Check 0\.2\.0-alpha/);
  assert.equal(t.trim().split('\n').length, 2 + 121);
  const p = m.plateCsv(base());
  assert.equal(p.trim().split('\n').length, 2 + 36);
  assert.match(p, /\nA1,1,1,/);
});

test('version is consistent with package.json', async () => {
  const {readFile} = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.version, m.VERSION);
});

test('single-use ceiling index is the ratio, not p times the ratio', () => {
  const c = m.preset('single'), ix = m.indices(c);
  assert.equal(ix.handlingAsymptote, Math.min(1, c.E / c.T));
  const long = {...c, window: 400, kbg: 0};
  const L = m.simulate(long).end.lysis;
  assert.ok(L <= ix.handlingAsymptote + 1e-9);
  assert.ok(L > c.p * c.E / c.T, 'retries let lysis pass pE/T');
});

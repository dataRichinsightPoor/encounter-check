import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../web/model.js';

const near = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);
const bi = (o = {}) => ({...m.preset('bispecific'), ...o});
const pM = 1e-12, nM = 1e-9;

test('without the drug, v0.1 results are unchanged', () => {
  const c = m.preset();
  assert.equal(c.drug, 'none');
  assert.equal(m.effectiveP(c), c.p);
  near(m.endpoint(c).end.lysis, 0.4110, 5e-4);
  assert.equal(m.drugState(c), null);
  assert.equal(m.doseResponse(c), null);
});

test('free drug satisfies the well-wide mass balance', () => {
  for (const conc of [0.01, 1, 5, 100, 1e5]) {
    const c = bi({conc}), D = m.freeDrug(c);
    assert.ok(D >= 0 && D <= conc * pM);
    near(m.totalFromFree(c, D), conc * pM, conc * pM * 1e-10);
  }
});

test('site concentrations follow counts, copies and volume', () => {
  const c = bi(), {ST, SE} = m.sitePools(c);
  near(ST, 1e4 * 1e5 / (m.AVOGADRO * 1e-4), 1e-20);
  near(SE, 1e4 * 5e4 / (m.AVOGADRO * 1e-4), 1e-20);
  near(ST / pM, 16.605, 1e-3);
});

test('with depletion off, free drug equals total drug', () => {
  const c = bi({depletion: 'off', conc: 3});
  assert.equal(m.freeDrug(c), 3 * pM);
});

test('bridge index peaks at one at the geometric mean of the two KDs', () => {
  const c = bi(), Ds = m.peakFree(c);
  near(Ds, Math.sqrt(0.01 * 50) * nM, 1e-20);
  near(m.bridgeIndex(c, Ds), 1, 1e-12);
  for (const x of [0.5, 0.99, 1.01, 2]) assert.ok(m.bridgeIndex(c, Ds * x) < 1);
});

test('bridge index is symmetric in log dose about its peak', () => {
  const c = bi({KT: 0.3, KE: 20}), Ds = m.peakFree(c);
  for (const x of [1.5, 10, 1000]) near(m.bridgeIndex(c, Ds * x), m.bridgeIndex(c, Ds / x), 1e-12);
});

test('no drug means no effector killing', () => {
  const r = m.simulate(bi({conc: 0}));
  assert.equal(r.end.killed, 0);
  assert.ok(r.end.background > 0);
});

test('peak kill probability is p_max(1 - exp(-s))', () => {
  const c = bi(), s = m.drugState({...c, depletion: 'off', conc: m.peakFree(c) / pM});
  near(s.bridge, 1, 1e-12);
  near(s.pEff, c.p * (1 - Math.exp(-c.trigger)), 1e-12);
});

test('half-maximal doses bracket the peak and return half the plateau', () => {
  const c = bi(), p = m.potency(c);
  assert.ok(p.ec50Free < p.peakFree && p.peakFree < p.hookFree);
  near(m.endpoint({...c, conc: p.ec50Total / pM}).end.lysis, p.emax / 2, 1e-6);
  near(m.endpoint({...c, conc: p.hookTotal / pM}).end.lysis, p.emax / 2, 1e-6);
  near(p.ec50Total, m.totalFromFree(c, p.ec50Free), 1e-24);
});

test('free potency is unchanged by depletion; total potency carries the bound drug', () => {
  const on = m.potency(bi()), off = m.potency(bi({depletion: 'off'}));
  near(on.ec50Free, off.ec50Free, on.ec50Free * 1e-8);
  near(off.ec50Total, off.ec50Free, 1e-24);
  assert.ok(on.ec50Total > on.ec50Free * 2);
});

test('default bispecific numbers: density moves the plateau and total EC50 in opposite directions to free EC50', () => {
  const r = m.doseResponse(bi());
  const emax = r.rows.map(x => x.emax), free = r.rows.map(x => x.ec50Free / pM), tot = r.rows.map(x => x.ec50Total / pM);
  [0.2766, 0.4051, 0.5354].forEach((v, i) => near(emax[i], v, 5e-4));
  [1.72, 1.60, 1.47].forEach((v, i) => near(free[i], v, 0.01));
  [2.94, 3.89, 5.74].forEach((v, i) => near(tot[i], v, 0.01));
  near(r.foldTotal, 1.95, 0.01);
  near(r.foldFree, 0.86, 0.01);
  near(r.depletionShift, r.totalShift - r.contactShift, 1e-12);
  assert.ok(r.contactShift < 0 && r.totalShift > 0);
});

test('at the working dose, a fourfold density span barely moves lysis', () => {
  const r = m.doseResponse(bi());
  const at = r.rows.map(x => x.lysisAtDose);
  [0.184, 0.235, 0.245].forEach((v, i) => near(at[i], v, 1e-3));
  const ff = r.rows.map(x => x.freeFractionAtDose);
  assert.ok(ff[0] > ff[1] && ff[1] > ff[2]);
});

test('settled volume probe moves lysis only through depletion', () => {
  const p = m.doseResponse(bi()).probe;
  near(p.lysisRefNoDep, p.lysisVolNoDep, 1e-9);
  near(p.lysisRef, 0.235, 1e-3);
  near(p.lysisVol, 0.176, 1e-3);
  assert.ok(p.ec50Vol > p.ec50Ref);
});

test('density-preserving scaling stays exact with the drug', () => {
  const c = bi(), f = 0.37;
  near(m.endpoint(c).end.lysis, m.endpoint({...c, E: c.E * f, T: c.T * f, volume: c.volume * f, area: c.area * f}).end.lysis, 1e-8);
});

test('dose curves are bell shaped and depletion shifts them right', () => {
  const r = m.doseResponse(bi());
  for (const cv of r.curves) {
    const i = cv.freeEqualsTotal.indexOf(Math.max(...cv.freeEqualsTotal));
    assert.ok(i > 0 && i < r.doses.length - 1);
    cv.withDepletion.forEach((y, j) => assert.ok(y <= cv.freeEqualsTotal[j] + 1e-9 || r.doses[j] * pM > m.peakFree(bi())));
  }
});

test('plate crosses doses with the design and exports them', () => {
  const c = bi(), p = m.plateMap(c);
  assert.equal(p.total, 36);
  assert.deepEqual([...new Set(p.conditions.map(x => x.dose))], [1, 5, 25]);
  const csv = m.plateCsv(c).split('\n');
  assert.match(csv[0], /dose in pM total/);
  assert.ok(csv[1].split(',').includes('dose') && csv[1].split(',').includes('freeFraction'));
});

test('dose-response CSV has one column pair per density', () => {
  const lines = m.doseCsv(bi()).trim().split('\n');
  assert.match(lines[0], /^# Encounter Check 0\.2\.1-alpha dose response/);
  assert.equal(lines[1].split(',').length, 7);
  assert.equal(lines.length, 2 + 41);
  assert.throws(() => m.doseCsv(m.preset()), /bispecific/);
});

test('drug inputs are validated', () => {
  assert.throws(() => m.validate(bi({KT: 0})), /Target-arm KD/);
  assert.throws(() => m.validate(bi({doseHigh: 0.05})), /Highest curve dose/);
  assert.throws(() => m.validate(bi({drug: 'trivalent'})), /Drug mode/);
  assert.throws(() => m.validate(bi({depletion: 'maybe'})), /depletion/);
});

test('older scenario files load without the drug', () => {
  const old = {...m.preset()};
  for (const k of ['drug', 'conc', 'KT', 'KE', 'RT', 'RE', 'trigger', 'depletion', 'doseLow', 'doseHigh']) delete old[k];
  const c = m.unpack(JSON.stringify({tool: 'encounter-check', version: '0.1.0-alpha', scenario: old}));
  assert.equal(c.drug, 'none');
  const b = m.unpack(m.pack(bi()));
  assert.equal(b.drug, 'bridged');
  assert.deepEqual(b.plate.doses, [1, 5, 25]);
});

test('identifiability reports effective kill probabilities under the drug', () => {
  const r = m.identifiability(bi());
  near(r.pEffRef, m.effectiveP(bi()), 1e-12);
  assert.ok(r.pEffAlt < r.pEffRef);
  assert.ok(r.maxLysisGap < 0.02);
});

# Encounter Check: mathematical contract

99 Small Problems: Useful models for assumptions with expensive ambitions. No. 05. v0.2.1-alpha.

The question is narrow. Two co-cultures share an effector-to-target ratio. Do they share an experiment? A ratio is a proportion of counts. Contact is a rate, and a rate depends on how many cells occupy the space in which they meet. This contract states what the tool computes, which assumptions produce each number, and which measurement would separate explanations that a lysis endpoint cannot.

## Scope and state

One effector population meets one target population in a well-mixed compartment of size \(G\). The state vector is

\[
y=(E_f,\;T_f,\;C,\;R,\;D_k,\;D_b,\;N),
\]

free effectors, free targets, effector–target conjugates, refractory effectors that have killed and not yet recovered, targets killed by effectors, targets lost to background death, and the cumulative number of encounters. Initial conditions are \(E_f(0)=E_0\), \(T_f(0)=T_0\), and zero for every other state. Counts are cells per well.

The compartment size \(G\) is a declared hypothesis about where contact happens:

- settled: \(G=A\), the well-bottom area in mm², with \(k\) in mm²/h;
- bulk: \(G=V\), the medium volume in µL, with \(k\) in µL/h.

## Rate equations

Encounters follow mass action in density units:

\[
J=\frac{k}{G}\,E_fT_f .
\]

A conjugate lasts a mean time \(\tau_c\) and ends in one of two ways. With probability \(p\) it kills the target, and with probability \(1-p\) both cells separate intact. The competing first-order exits therefore have rates

\[
\kappa=\frac{p}{\tau_c},\qquad \delta=\frac{1-p}{\tau_c}.
\]

For serial killers with refractory time \(\tau_R>0\):

\[
\begin{aligned}
\dot E_f &= -J+(\delta+k_{bg})\,C+\frac{R}{\tau_R},\\
\dot T_f &= -J+\delta C-k_{bg}T_f,\\
\dot C &= J-(\delta+\kappa+k_{bg})\,C,\\
\dot R &= \kappa C-\frac{R}{\tau_R},\\
\dot D_k &= \kappa C,\qquad \dot D_b=k_{bg}(T_f+C),\qquad \dot N=J .
\end{aligned}
\]

Background death at rate \(k_{bg}\) removes live targets whether free or conjugated. A conjugated target that dies of background causes returns its effector directly to the free pool. When \(\tau_R=0\), the refractory state is skipped and killing returns effectors immediately (\(\kappa C\) enters \(\dot E_f\)). In single-use mode, killing sends effectors to \(R\) and they never return.

Two conservation laws hold at every time and are tested:

\[
E_f+C+R=E_0\quad(\text{serial}),\qquad T_f+C+D_k+D_b=T_0 .
\]

In single-use mode \(R\) accumulates spent effectors, so the effector law still holds with \(R\) read as "used."

## Readouts

Effector-attributed lysis is the fraction of initial targets killed by effectors:

\[
L(t)=\frac{D_k(t)}{T_0}.
\]

A plate reader cannot see \(D_k\) directly. It sees total loss relative to a target-only control. With control loss \(D_{ctrl}(t)=T_0(1-e^{-k_{bg}t})\), specific lysis is

\[
L_{spec}(t)=\frac{D_k+D_b-D_{ctrl}}{T_0-D_{ctrl}} .
\]

The two agree exactly when \(k_{bg}=0\). With background death, specific lysis is slightly larger, because some targets that would have died anyway die in conjugates and are counted as effector kills. The conjugated-target fraction at the contact read time is \(C(t_r)/T_0\). Mean encounters per target is \(N(t)/T_0\).

Integration uses an adaptive Dormand–Prince 5(4) scheme with relative and absolute tolerance \(10^{-9}\), the method of [Dormand and Prince (1980)](https://doi.org/10.1016/0771-050X(80)90013-3).

## Two exact identities

Only the ratio \(k/G\) enters the equations, and cell counts enter only through \(J\). Two consequences are exact, not approximate.

First, densities rather than counts define the prediction. Multiply \(E_0\), \(T_0\) and \(G\) by the same factor \(f\). Every state scales by \(f\), \(J\) scales by \(f\), and every fraction \(L\), \(C/T_0\) and \(N/T_0\) is unchanged. A density-preserving redesign therefore reproduces the reference well exactly.

Second, density trades against time. Multiply both initial densities by \(\lambda\), every first-order rate (\(1/\tau_c\), \(1/\tau_R\), \(k_{bg}\)) by \(\lambda\), and divide the clock by \(\lambda\). Substituting \(s=\lambda t\) returns the original system. So a denser well is not simply "more of the same experiment"; it is the same mechanism run at a different speed relative to conjugate lifetime, recovery and background death. When those intrinsic clocks are fixed, as they are in a real assay, changing density at constant ratio changes the answer.

## Initial-condition indices

The indices describe time zero and are labeled as such in the tool. Per-target and per-effector encounter rates are

\[
a_0=\frac{kE_0}{G},\qquad b_0=\frac{kT_0}{G}.
\]

A serial killer is unavailable for the conjugate lifetime and, after a kill, for the refractory time. The mean handling time per contact is

\[
h=\tau_c+p\,\tau_R .
\]

In target excess each effector cycles between a search of mean length \(1/b_0\) and a handling period \(h\). The fraction of time spent searching and the steady kill rate per effector are

\[
S=\frac{1/b_0}{1/b_0+h}=\frac{1}{1+b_0h},\qquad r_{kill}=\frac{p}{1/b_0+h}.
\]

This is a saturating functional response written for effector cells, and the same structure underlies the double saturation described by [Gadhamsetty et al. (2014)](https://pubmed.ncbi.nlm.nih.gov/24739177/). When \(S\to1\), effectors are search-limited and the per-target killing rate scales with effector density, so the ratio is not a sufficient description. When \(S\to0\), effectors are saturated with targets and each kills at close to \(p/h\), so the fraction killed tracks \((E_0/T_0)\,t\). The tool sorts \(S>0.67\) as search-limited, \(S<0.2\) as handling-limited, and the interval between as mixed. The cut points are presentation choices, not biology.

## Ceilings

Two bounds bracket the serial-killer endpoint. If effectors never saturated and conjugate time were negligible, each free target would face a kill hazard \(p\,a_0\), so

\[
L(t)\le 1-e^{-p\,a_0t}\quad\text{(encounter ceiling)}.
\]

Conjugate time, effector depletion and background competition can only slow killing, so the ceiling is an upper bound, and it is reached in the limit \(\tau_c\to0\) with effectors in excess. That limit is tested, including the fact that it does not depend on \(T_0\).

If every effector were always busy handling, the most any effector can kill is \(p/h\) per unit time:

\[
L(t)\le\min\!\left(1,\;\frac{E_0}{T_0}\,\frac{p}{h}\,t\right)\quad\text{(handling ceiling)}.
\]

Single-use effectors are different. An effector that separates without killing can try again, so given enough time each effector eventually kills once. The ceiling is the ratio itself,

\[
L(\infty)\le\min\!\left(1,\;\frac{E_0}{T_0}\right),
\]

and not \(p\,E_0/T_0\). The kill probability sets how fast the ceiling is approached, not where it lies.

## Density sensitivity at fixed ratio

The fixed-ratio scan multiplies \(E_0\) and \(T_0\) by factors between the declared low and high span and holds \(G\) fixed. The spread is \(L(f_{hi})-L(f_{lo})\). The local density elasticity is a central difference on the log scale,

\[
\varepsilon=\frac{\partial\ln L}{\partial\ln f}\bigg|_{f=1}\approx\frac{\ln L(1.02)-\ln L(1/1.02)}{2\ln1.02}.
\]

An elasticity near one means lysis is proportional to density, the encounter-limited, low-lysis regime. Near zero, the ratio carries the information. The heatmap evaluates \(L\) on a 17 × 17 logarithmic grid of effector and target counts spanning fourfold either side of the reference. If the ratio were sufficient, color would be constant along each diagonal of constant \(E_0/T_0\).

## Geometry discrimination: volume or area?

Suspension cells settle, so contact may be governed by bottom area rather than medium volume. The two hypotheses are matched at the reference well so that neither is favored by construction. Holding the per-target encounter rate \(kE_0/G\) equal requires

\[
k_{alt}=k\,\frac{G_{alt}}{G}.
\]

With \(k=0.002\) mm²/h, \(V=100\) µL and \(A=32\) mm², the matched bulk coefficient is \(0.00625\) µL/h. Both hypotheses then give identical trajectories in the reference well. They disagree about perturbations. At fixed counts, a volume change moves only the bulk prediction, and a bottom-area change moves only the settled prediction. In the default case, halving the volume leaves settled lysis at 41.1% and raises bulk lysis to 54.2%. Moving to a well with 0.175 times the area raises settled lysis to 70.0% and leaves bulk at 41.1%.

The time to settle is estimated from Stokes' law for a sphere of diameter \(d\) and density excess \(\Delta\rho\) in medium of viscosity \(\mu\):

\[
v=\frac{2}{9}\,\frac{\Delta\rho\,g\,(d/2)^2}{\mu},\qquad t_{settle}=\frac{V/A}{v}.
\]

With \(d=10\) µm, \(\Delta\rho=50\) kg/m³ and \(\mu=0.78\times10^{-3}\) Pa·s, a 3.125 mm column takes about 15 minutes. The density excess and viscosity are order-of-magnitude assumptions, and convection, handling and round-bottom geometry all change the estimate.

Mass action assumes contacts are rare relative to available space. The tool reports the bottom fraction covered by cell footprints,

\[
\phi=\frac{(E_0+T_0)\,\pi(d/2)^2}{A},
\]

and flags wells above \(\phi=0.25\) as places where well-mixed contact becomes questionable. The threshold is a warning, not a phase boundary.

## Redesign when targets are scarce

When only \(T'\) targets are available, with \(f=T'/T_0\), three rebuilds are compared: keep the ratio in the same well (\(E'=fE_0\)), keep the effector count in the same well, or keep both densities by scaling the well (\(E'=fE_0\), \(V'=fV\), \(A'=fA\)). By the first identity above, only the third reproduces the reference exactly. In the default case, halving targets while keeping the 1:1 ratio lowers lysis from 41.1% to 28.1%.

## Identifiability: lysis cannot see contacts

A lysis endpoint integrates contact frequency and per-contact killing. The rival hypothesis multiplies \(k\) by a declared factor \(m\) and re-solves the kill probability \(p^*\) so that reference lysis at the end of the window matches:

\[
L\big(t_{end};\,mk,\,p^*\big)=L\big(t_{end};\,k,\,p\big).
\]

Lysis increases monotonically with \(p\) at fixed \(k\), so \(p^*\) is found by bisection on \([0,1]\) to machine precision. If no \(p^*\le1\) reproduces the reference, the tool says so rather than extrapolating. With \(m=2\), the default gives \(p^*=0.344\). Across the whole window the two lysis curves never differ by more than 0.9 percentage points, but at 1 h the rival holds 1.5 times as many targets in conjugates (35.8% against 24.1%). A conjugate readout by imaging or flow separates the explanations; a fixed-ratio density series does so only weakly.

## Plate design

The plate builder crosses declared E:T ratios, target counts and medium volumes, then replicates each condition. For every condition it reports lysis under the matched settled and bulk hypotheses, the conjugated fraction at the read time under the declared geometry, the search fraction, and footprint coverage. Wells are laid out in row order on a 96-well plate, and designs larger than 96 wells are rejected. Ratio-only reasoning predicts flat rows across target counts. Density-dependent killing predicts a slope, and the volume factor tests which density applies.

## The bispecific bridge (v0.2)

Everything above treats \(p\) as a property of the cells. With a bispecific drug, a contact kills only if drug links the two cells, so \(p\) becomes a function of how much drug is free. Version 0.2 adds that step and keeps the contact equations unchanged. The drug changes what a contact does, not how often contacts happen.

### Mass balance

Let \(R_T\) antigens sit on each target and \(R_E\) receptors on each effector. In medium volume \(V\), the molar concentrations of binding sites are

\[
S_T=\frac{T_0R_T}{N_AV},\qquad S_E=\frac{E_0R_E}{N_AV}.
\]

Each arm binds monovalently with dissociation constants \(K_T\) and \(K_E\), and binding reaches equilibrium before killing begins. Arm occupancies are \(\theta_T=D/(D+K_T)\) and \(\theta_E=D/(D+K_E)\) at free concentration \(D\). Treating bridges as rare relative to singly bound drug, total drug is

\[
C_{tot}=D+S_T\,\theta_T(D)+S_E\,\theta_E(D).
\]

The right side increases monotonically in \(D\), so \(D\) is found by bisection on \([0,C_{tot}]\). When cells are declared not to bind drug, \(D=C_{tot}\). Binding sites scale with cells per volume, not cells per area. That is the second way density enters.

### Bridge index

A bridge forms when target-bound drug meets a free effector receptor, or effector-bound drug meets a free antigen. Following the three-body equilibrium treatment of [Douglass et al. (2013)](https://doi.org/10.1021/ja311795d), and taking each surface cross-linking constant as proportional to the corresponding solution affinity with no cooperativity,

\[
\text{bridges}\;\propto\;\frac{\theta_T(1-\theta_E)}{K_E}+\frac{\theta_E(1-\theta_T)}{K_T}=\frac{2D}{(D+K_T)(D+K_E)}.
\]

This is maximal at \(D^*=\sqrt{K_TK_E}\), where it equals \(2/(\sqrt{K_T}+\sqrt{K_E})^2\). Normalizing gives the bridge index

\[
B(D)=\frac{D\,\big(\sqrt{K_T}+\sqrt{K_E}\big)^2}{(D+K_T)(D+K_E)},\qquad 0\le B\le1,\quad B(D^*)=1 .
\]

Below \(D^*\) too few arms are occupied. Above it, both cell surfaces saturate with singly bound drug and bridges fall, which is the hook.

### Kill probability per contact

A conjugate kills with probability

\[
p_{eff}(D)=p_{max}\big(1-e^{-sB(D)}\big),
\]

where \(p_{max}\) is the kill probability entered in the contact section and \(s\) is a declared trigger strength. The rate equations use \(p_{eff}\) in place of \(p\). Because binding is fixed at time zero, the drug is not consumed as targets die.

### Potency and its decomposition

For each well, \(E_{max}\) is lysis at \(D^*\), the well's own plateau. The free EC50, \(D_{50}\), is the lower free concentration giving \(E_{max}/2\), found by bisection on a log scale. The total EC50 then follows exactly from the mass balance:

\[
EC_{50}^{tot}=D_{50}+S_T\,\theta_T(D_{50})+S_E\,\theta_E(D_{50}).
\]

Across a fixed-ratio density span from factor \(f_{lo}\) to \(f_{hi}\),

\[
\log_{10}\frac{EC_{50}^{tot}(f_{hi})}{EC_{50}^{tot}(f_{lo})}=\underbrace{\log_{10}\frac{D_{50}(f_{hi})}{D_{50}(f_{lo})}}_{\text{contact}}+\underbrace{\log_{10}\frac{EC_{50}^{tot}(f_{hi})/D_{50}(f_{hi})}{EC_{50}^{tot}(f_{lo})/D_{50}(f_{lo})}}_{\text{depletion}} .
\]

The contact term is small and slightly negative: more encounters mean a smaller \(p_{eff}\) reaches half of a higher plateau. The depletion term is positive, because denser wells hold more drug on cells.

In the synthetic default (1:1, settled geometry, 32 mm², 100 µL, 4 h; \(K_T=0.01\) nM, \(K_E=50\) nM, \(R_T=10^5\), \(R_E=5\times10^4\), \(s=4\), \(p_{max}=0.5\)), the plateau rises from 27.7% to 53.5% across the 4-fold span. Free EC50 moves from 1.72 to 1.47 pM (0.86-fold). Total EC50 moves from 2.94 to 5.74 pM (1.95-fold). At a 5 pM working dose the free fraction falls from 61% to 25%, and lysis runs only from 18.4% to 24.5%. The higher plateau and the rightward shift nearly cancel at one dose, so a flat single-dose response across density is not evidence that the ratio suffices.

### The volume probe

Change the medium volume by a factor \(v\) at fixed cell counts and fixed total concentration. Under the settled hypothesis, contact depends on bottom area and is unchanged, while \(S_T\) and \(S_E\) scale by \(1/v\). Any change in lysis is therefore depletion. In the default, halving the medium lowers lysis from 23.5% to 17.6% with binding and leaves it at 32.5% without binding; total EC50 rises from 3.89 to 6.18 pM. Under the bulk hypothesis, volume also changes contact, so the probe mixes both effects and the tool says so.

## Boundary conditions and excluded inferences

The model is a well-mixed, short-window mass-action description with one contact state, one kill transition, optional recovery and first-order background death. It excludes proliferation, activation delay, exhaustion, cytokine effects, multicellular conjugates, cooperative killing, target heterogeneity, motility-limited or aggregated contact, and adherent geometry. Each can change the ranking. The drug step adds its own limits: monovalent equilibrium binding fixed at time zero, bridges neglected in the mass balance, no cooperativity or avidity, no internalization, shedding or soluble antigen, and no drug consumption by killing. Rate constants are declared, not fitted. There is no confidence coverage, no power calculation and no cost weighting. Passing software tests shows that the code implements these equations; it is not biological validation. All presets are synthetic, and no experimental, employer or confidential data are included.

## References

1. Gadhamsetty S, Marée AFM, Beltman JB, de Boer RJ. A general functional response of cytotoxic T lymphocyte-mediated killing of target cells. Biophysical Journal. 2014;106(8):1780–1791. [doi:10.1016/j.bpj.2014.01.048](https://doi.org/10.1016/j.bpj.2014.01.048). The focal study: killing saturates in both effector and target density, which is why neither the ratio nor a single density is sufficient in general.
2. Gadhamsetty S, Marée AFM, Beltman JB, de Boer RJ. A sigmoid functional response emerges when cytotoxic T lymphocytes start killing fresh target cells. Biophysical Journal. 2017;112(6):1221–1235. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0006349517301674).
3. Ganusov VV, Barber DL, De Boer RJ. Killing of targets by CD8+ T cells in the mouse spleen follows the law of mass action. PLoS One. 2011;6(1):e15959. [PMC3025913](https://pmc.ncbi.nlm.nih.gov/articles/PMC3025913/).
4. Halle S, Keyser KA, Stahl FR, et al. In vivo killing capacity of cytotoxic T cells is limited and involves dynamic interactions and T cell cooperativity. Immunity. 2016;44(2):233–245. [doi:10.1016/j.immuni.2016.01.010](https://doi.org/10.1016/j.immuni.2016.01.010).
5. Jiang X, Chen X, Carpenter TJ, et al. Development of a target cell-biologics-effector cell (TBE) complex-based cell killing model to characterize target cell depletion by T cell redirecting bispecific agents. mAbs. 2018;10(6):876–889. [PMC6152432](https://pmc.ncbi.nlm.nih.gov/articles/PMC6152432/).
6. Perelson AS, Bell GI. Delivery of lethal hits by cytotoxic T lymphocytes in multicellular conjugates occurs sequentially but at random times. Journal of Immunology. 1982;129(6):2796–2801. [Journal of Immunology](https://academic.oup.com/jimmunol/article-abstract/129/6/2796/8076787).
7. Douglass EF Jr, Miller CJ, Sparer G, Shapiro H, Spiegel DA. A comprehensive mathematical model for three-body binding equilibria. Journal of the American Chemical Society. 2013;135(16):6092–6099. [doi:10.1021/ja311795d](https://doi.org/10.1021/ja311795d). The source of the bell-shaped ternary-complex dependence and the \(\sqrt{K_TK_E}\) optimum.
8. Schropp J, Khot A, Shah DK, Koch G. Target-mediated drug disposition model for bispecific antibodies: properties, approximation, and optimal dosing strategy. CPT: Pharmacometrics & Systems Pharmacology. 2019;8(3):177–187. [doi:10.1002/psp4.12369](https://doi.org/10.1002/psp4.12369).
9. Dormand JR, Prince PJ. A family of embedded Runge–Kutta formulae. Journal of Computational and Applied Mathematics. 1980;6(1):19–26. [doi:10.1016/0771-050X(80)90013-3](https://doi.org/10.1016/0771-050X(80)90013-3).

Well-bottom areas follow [Corning's application note](https://www.corning.com/catalog/cls/documents/application-notes/CLS-AN-209.pdf): about 0.32 cm² for a flat 96-well and about 0.056–0.06 cm² for a flat 384-well.

# Refill Resolution Engine: Go-To-Market

This is the commercial half of the challenge (Track 03). A strong product that nobody
adopts fails the brief, so this document answers three things: who buys this and why,
how we move them from unaware to paying and expanding, and how we price it. The funnel
is deliberately tied to the same metrics the product itself computes, so the growth
engine is self-instrumenting rather than a set of claims.

---

## Who we sell to

### The ICP, and why we commit to it

**Primary ICP: mid-size physician practices and physician groups with high chronic-care
refill volume**, roughly 5 to 50 providers, in primary care, endocrinology, cardiology,
and behavioral health.

We defend this choice on four grounds:

1. **They own the bottleneck.** The stall the brief describes happens the moment
   *provider intervention* is required. That intervention lives inside the practice, so
   the practice is where the pain concentrates and where a fix has leverage. Pharmacies
   feel the patient's frustration, but they cannot resolve a provider-approval block.
2. **The cost is concrete and measurable.** Chronic-care practices run the highest
   recurring refill load, and they staff refill coordinators to handle it. That means
   the pain shows up as staff hours, a number we can baseline and then reduce.
3. **The buyer has budget authority.** A practice administrator or group operations lead
   can approve an operational tool without a year-long committee, unlike a large health
   system.
4. **It is a repeatable motion.** There are many such practices, they share a workflow,
   and they are large enough to pay yet small enough to land in weeks. That is the
   definition of a beachhead.

**Beachhead:** independent and small-group practices in chronic-heavy specialties. Land
there, prove value, then expand upward into physician groups and management services
organizations (MSOs). Pharmacies are a channel and a future second side of the network,
not the first buyer.

### User, buyer, champion: not the same person

Weak positioning says "our customer is everyone in the prescription chain." Strong
positioning separates the roles, because you sell to each of them differently.

| Role | Who | What they care about |
|---|---|---|
| **User** | Refill coordinator, medical assistant, practice staff | Fewer phone-and-fax cycles, a clear queue, less thankless chasing |
| **Economic buyer** | Practice administrator, office manager, group operations lead | Staff hours saved, cost, a clean security story |
| **Champion** | Lead physician drowning in refill inbox load | Getting the administrative burden off their desk while keeping clinical control |
| **Security influencer** | Practice IT or a compliance contact | HIPAA posture, BAA, RBAC, audit trail |
| **External stakeholders** | Pharmacy (initiates requests), patient (experiences the outcome) | Visibility and a faster result |

The champion gets us in the door, the security influencer clears the path, and the
economic buyer signs. The user's daily relief is what drives retention and expansion.

### Positioning

The refill-resolution layer for chronic-care practices. We turn provider-intervention
refills from phone-and-fax tag into a tracked queue that resolves in hours instead of
days, with the provider in control of every clinical decision and a full audit trail
behind every step.

---

## The value we can measure

Every stage below points back to a small set of numbers. These are the same figures the
product computes in `metrics.py`, which means the customer watches their own ROI accrue
inside the tool. All targets here are hypotheses to be proven per account against a
captured baseline, not results we are claiming.

- **Staff touches per provider-intervention refill.** Baseline near six hand-offs.
  Target: around two.
- **Time to resolution.** From days of back-and-forth to hours.
- **Coordinator hours reclaimed per week.**
- **Share of refills stuck longer than 48 hours.**
- **Patient "where is my medication" call volume.**

---

## The funnel, stage by stage

The customer-journey diagram has eight stages. For each we define what happens, the
signal that a customer is ready to advance, and the action we take.

| Stage | What happens | Signal to advance | Our action |
|---|---|---|---|
| **01 Nothing** | Define the ICP precisely, build a target list from specialty directories and group affiliations, set up tracking | Account matches the ICP: specialty, provider count, chronic-care load | Add to the target list, begin research |
| **02 Prospect** | Research the practice, identify the coordinator (user), administrator (buyer) and lead physician (champion), estimate refill burden | Confirmed manual workflow, coordinator overload, or patient complaints about refill delays | Pain-specific outreach to the champion and administrator |
| **03 Data Analysis** | A short discovery or workflow assessment. Quantify refill volume, resolution time, staff touches, blocked-refill rate | A measurable inefficiency worth fixing (for example, many coordinator hours per week on refills) | Build a tailored ROI hypothesis for this account, qualify it in or out |
| **04 TOFU** | Educational content on where refill workflows get stuck, coordinator burnout, and the adherence impact of delays. Specialty-association channels and webinars | Engagement: content interaction, webinar attendance, an inbound question | Nurture and invite to a demo |
| **05 MOFU** | Live demo of a stuck refill moving from blocked, to identified, to assigned, to provider review, to resolved, with the audit trail and metrics visible. Bring in administrator, physician and IT | A demo request, several stakeholders engaged, questions about security and integration | Propose a scoped pilot, share the security and intelligence design doc |
| **06 BOFU** | A 30-day pilot on one specialty or one site. Capture a baseline first, then run. Security review. Pricing discussion | Pilot hits target metrics, decision-maker engaged, security cleared, ROI conversation underway | Present pilot results against the baseline, move to contract |
| **07 Close** | Finalize contract and pricing, agree an implementation plan, onboard coordinators, connect integrations, configure roles | Signed contract, implementation scheduled, internal approvals complete | Kick off onboarding, assign a customer-success owner |
| **08 Customer Success** | Track usage and outcomes on the live metrics, run periodic reviews that show hours saved, identify expansion | Active usage, target ROI achieved, expansion interest | Expand seats and sites, turn the champion into a reference, pursue the group or MSO above the account |

---

## Pricing

**Model: per-provider, per-month subscription.** We price by provider count because
refill load scales with the number of prescribers, so the price tracks the value the
customer receives and grows naturally as the account grows. A per-provider model is also
predictable for a practice administrator to budget, unlike per-transaction pricing that
spikes in a busy month.

The number itself is set per account against the ROI hypothesis from stage 03: the
subscription is anchored to a fraction of the staff cost it removes, so the tool pays for
itself in reclaimed coordinator hours. As a worked example of the logic (illustrative,
to be validated per account): if a practice spends a meaningful share of a coordinator's
week resolving stuck refills, and the tool removes most of that, the monthly fee is set
comfortably below the value of the hours returned. A short pilot proves that ratio before
any contract is signed.

**Expansion levers** (the reason this is a growth engine, not a one-time sale):

- More providers onboarded within the same practice.
- Additional sites in a multi-location group.
- Moving up-market from a single practice to the physician group or MSO that owns it.
- Pharmacy partnerships as a future networked, second-side offering.

---

## The growth engine

The land-and-expand motion is repeatable because each step de-risks the next:

Land one specialty or one site, capture a baseline, and run a 30-day pilot. The product
instruments its own ROI, so the customer sees touches per refill and resolution time
improve in their own dashboard. That shortens the bottom of the funnel: the pilot result,
measured against the baseline, is the sales argument. A proven site expands to more
providers and more locations, then to the group or MSO above it, and the satisfied
champion becomes a reference into the next account.

This is why the commercial story and the product story are one story. The metrics that
prove value to a buyer are the same metrics the operator uses every day, computed by the
same code. Product answers what should exist, intelligence answers how the system thinks
and stays in human control, and this funnel answers who pays and why they keep paying.

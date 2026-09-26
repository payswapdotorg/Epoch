# Solution Navigator Projection Guide (SN1.0 → W036)

The Solution Navigator is the universal experience projection for moving
from an engineering problem to an approved solution, through delivery and
into outcome/learning. **It is not a separate data model.**

## The synchronized projections

`projectNavigator(inputs)` folds the eleven SN1.0 views over the SAME
sealed records (never copies with their own identities):

| View | Folded from |
|---|---|
| World View | the head version's solution lines' world-entity links (entity → lines) |
| Solution | the head version's lines (quantity + unit + optional world entity) |
| Decision | the baseline approvals (distinct authority acts) |
| ProgramOfWork | the program's work packages → activities |
| Schedule | the deterministic quantity/cost/resource/milestone folds |
| Acquisition | the acquisition requests (variant + anchors) |
| Realization | the realization-variant counts |
| Verification | the program's verification gates |
| Observations / Actuals | the delivery record's observations (with review state) and actuals |
| Forecast / Outcomes / Learning | the distinction ledger's records of those kinds |

Partial-data behavior (SN1.0): every input except the solution chain is
OPTIONAL — missing views project as EMPTY, never as blockers. The
Navigator remains useful with incomplete inputs; unknown/estimated/
assumed facts show their confidence, provenance and freshness through the
uncertainty states carried on the underlying records.

## Identity-preserving navigation

`navigateFromWorldEntity(projection, entityId)` walks the canonical chain
by ID — `world entity → solution line → work package → activity →
observation → actual → verification gate → outcome` — without creating
duplicate records. The traversal:

1. world entity → the solution lines addressing it (world view);
2. lines → the work packages linked by `solutionLineId` or by the same
   `worldEntityId`;
3. work packages → their activities;
4. activities → the delivery observations whose subject is one of those
   activities (with their accepted/rejected/proposed state);
5. observations → the actuals derived from them (accepted + actualized
   only — by construction);
6. activities → the verification gates gating them;
7. solution / lines / packages / activities → the outcome records for
   those subjects.

`navigatorChainIdentities(chain)` flattens the chain for
identity-preservation checks: every identity appears EXACTLY once (tested
— `new Set(identities).size === identities.length`).

## Human control and agent interaction (SN1.0)

The projections this kernel emits are pure folds: watch/observe, inspect,
replay and explanation all read the same records; pause/resume flow
through the lifecycle graph's typed self-relations; approvals are the
distinct baseline/work approval authority acts. Agents may inspect the
same projections, propose transitions, request information
(`InformationAcquisitionRequest`), monitor work and explain derivations —
they never become semantic authority by driving the Navigator.

## UX adaptation rule

The core Navigator supplies lifecycle position, semantic
identity/navigation, history/replay and decision/delivery/learning
continuity. Domain packs supply terminology (stage vocabulary), icons,
domain panels, specialized calculations and evidence methods — bound
through the pack profile's `stageVocabulary` and `projectionRules` (see
the pack-integration guide). This separation is the primary mechanism
that lets Epoch support new engineering domains without rebuilding the
platform.

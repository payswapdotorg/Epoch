# Epoch Solution Navigator Architecture SN1.0

## Purpose

The Solution Navigator is the universal experience projection for moving from an engineering problem to an approved solution, through delivery and into outcome/learning.

It is not a separate data model.

## Canonical navigation

1. Understand
2. Decide
3. Plan
4. Acquire
5. Realize
6. Observe / Actualize
7. Verify
8. Forecast
9. Close
10. Learn

A domain may expose additional substeps, but the Navigator must preserve the universal semantic identity and lifecycle position.

## Synchronized projections

At any point, the user can move among:
- World View;
- Solution / alternatives;
- Decision and evidence view;
- Program of Work;
- domain Solution Schedule;
- acquisition/procurement;
- realization/execution;
- verification;
- forecast;
- outcomes;
- learning.

Selection is identity-preserving. For example:
`World entity → solution line → work package → activity → observation → actual → verification → outcome`
must remain traversable without creating duplicate records.

## Construction projection

Construction may expose:
- interactive 2D/3D world;
- synchronized BOQ quantity/cost lines;
- construction Program of Work;
- procurement and supplier state;
- field observations;
- verification;
- forecast;
- final outcome.

BOQ is a projection of quantities/cost/work relationships, not the lifecycle authority.

## Non-construction projection examples

### Software
Solution architecture → epics/modules → release ProgramOfWork → cloud/license/data acquisition → implementation/deployment → telemetry/actualization → tests → service forecast → release outcome → engineering learning.

### Mechanical
Design alternative → BOM/work packages → manufacturing ProgramOfWork → material/tooling acquisition → fabrication/assembly → inspection/measurement → qualification → delivery forecast → performance outcome → process learning.

### Electrical
System alternative → circuits/work packages → install/commission programme → equipment/cable/capability acquisition → installation/commissioning → meter/inspection actuals → test certification → completion forecast → operating outcome → commissioning learning.

## Agent interaction

Agents may:
- inspect the same projections as humans;
- propose transitions or actions;
- request information;
- monitor work;
- explain derivations;
- ask for approval where required.

Agents do not become semantic authority by driving the Navigator.

## Human control

The Navigator must support:
- watch/observe;
- pause;
- inspect;
- take over;
- approve;
- release control back to an authorized agent;
- replay the decision/delivery path.

## Partial-data behavior

The Navigator should remain useful with incomplete inputs.

Unknown/estimated/assumed facts should show:
- confidence;
- provenance;
- freshness;
- decision impact;
- next acquisition option when material.

Do not turn every missing value into a blocking form.

## UX adaptation rule

Domain packs supply:
- terminology;
- icons/visualizations;
- domain-specific panels;
- specialized calculations;
- domain evidence methods.

The core Navigator supplies:
- lifecycle position;
- semantic identity/navigation;
- authorization-aware projections;
- history/replay;
- decision/delivery/learning continuity.

This separation is the primary mechanism that lets Epoch support new engineering domains without rebuilding the platform.

# Domain Pack Integration Guide (DP1.0 → W036)

A domain pack TEACHES Epoch how a domain expresses the universal
lifecycle. It never replaces the lifecycle, the World Model, the delivery
state, the authorization, the verification or the event authority. This
guide documents how a pack binds to `@epoch/solution-delivery`.

## The pack profile

`SolutionPackProfile` is the machine-readable binding (admitted by
`admitPackProfile`):

```jsonc
{
  "schema": "epoch.solution-delivery.pack-profile",
  "schemaVersion": 1,
  "packId": "construction.core",          // dot-namespaced qualified name
  "packVersion": "1.2.0",                 // semver core
  "tenantId": "tenant:globex",            // installed per tenant
  "supportedLifecycleVersion": "1.0.0",   // MUST equal the USL version this kernel teaches
  "stageVocabulary": {                    // display vocabulary for EACH universal stage
    "understand": "Survey",
    "decide": "Design development",
    "plan": "Construction programming",
    "acquire": "Procurement",
    "realize": "Execution",
    "observe": "Field observation",
    "actualize": "Progress actualization",
    "verify": "Inspection & testing",
    "forecast": "Programme forecast",
    "close": "Handover",
    "learn": "Lessons learned"
  },
  "projectionRules": [                    // presentation per Navigator projection
    { "projection": "program-of-work", "presentation": "Construction programme" },
    { "projection": "schedule", "presentation": "BOQ quantity/cost schedule" },
    { "projection": "acquisition", "presentation": "Procurement register" },
    { "projection": "realization", "presentation": "Site execution log" }
  ],
  "measurementNote": "Quantities in BOQ conventions; unit costs per trade rate library",
  "capabilityDependencies": ["capability.cad-geometry"]
}
```

## What a pack MAY do

- Bind display vocabulary onto the ELEVEN universal stages
  (`stageVocabulary` — every stage, exactly the universal set).
- Bind presentation rules onto the ELEVEN Navigator projections
  (`projectionRules` over `world-view`, `solution`, `decision`,
  `program-of-work`, `schedule`, `acquisition`, `realization`,
  `verification`, `forecast`, `outcomes`, `learning`).
- Project domain schedules (BOQ, BOM, roadmap, commissioning plan) as
  folds/views over the SAME ProgramOfWork identities.
- Map domain acquisition paths onto the seven acquisition variants.
- Map domain realization patterns onto the seven realization variants.
- Add terminology, units, measurement methods, constraints, verification
  methods, visualizations, work templates and outcome schemas — through
  the Capability Registry and adapters, never as kernel authorities.

## What a pack may NEVER do (typed rejections)

| Forbidden pattern | Typed rejection |
|---|---|
| Declare `lifecycleAuthority` / `baselineAuthority` / `scheduleAuthority` / `deliveryAuthority` / `mutableActual` / … (the DP1.0 forbidden list) | `authority-violation-rejected` (pre-classified before schema validation) |
| Bind display vocabulary onto an INVENTED stage (`boq-generation`) or declare a `stages`/`universalStages` array with non-universal entries | `authority-violation-rejected` |
| Target a different lifecycle version | `validation` at path `supportedLifecycleVersion` |
| Carry provider fields (`revitTemplateId`, `sapPurchaseOrder`, …) | `vendor-fields-rejected` |
| Collapse the nine distinctions into one mutable value (record identity changing kind) | `distinction-collapse-rejected` |
| Forecast overwriting a historical prediction/baseline/actual | `forecast-overwrite-rejected` |
| Actualize an unaccepted observation | `unaccepted-actualization-rejected` |
| Mutate an approved baseline | `baseline-mutation-rejected` |
| Introduce schedule cycles | `schedule-cycle-rejected` |

## The acceptance checklist (DP1.0 → W036 evidence)

1. profile declares the universal lifecycle version — enforced
   (`supportedLifecycleVersion` must equal `SOLUTION_DELIVERY_USL_VERSION`);
2. workflows bind to canonical lifecycle objects — stage records,
   transitions, distinction records, delivery records all carry the
   canonical identities;
3. the pack schedule is a ProgramOfWork projection — the projectionRules
   bind onto `program-of-work` / `schedule`; no second schedule authority
   is expressible;
4. the acquisition path uses the universal Acquire contract — the
   seven-variant catalog;
5. the realization path uses the universal Realize contract — the
   seven-variant catalog;
6. evidence is addressable and reproducible — evidence references are
   exact-revision digests (W006 grammar), pinned by parity;
7. authorizations use Epoch authorization/projection contracts — this
   kernel references principals opaquely and never authorizes;
8. capability integrations are provider-neutral and replaceable —
   capability dependencies are opaque qualified names;
9. provider version/license/provenance data is retained where required —
   via evidence records and opaque references;
10. disabling the pack does not corrupt core semantic state — the pack is
    a projection layer; all state lives in the kernel contracts.

The neutrality tests (`test/neutrality.test.ts`) additionally prove no
Aurum-specific module/type/field and no vendor token can appear in the
kernel source or emitted artifacts.

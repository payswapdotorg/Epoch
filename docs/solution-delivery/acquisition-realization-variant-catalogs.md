# Acquisition and Realization Variant Catalogs (W036)

USL1.0 (binding): **Acquire** and **Realize** are universal concepts;
procurement and construction execution are domain/profession PROJECTIONS.
The catalogs below are CLOSED typed unions — provider-neutral, no vendor,
brand, marketplace, ERP or API vocabulary anywhere.

## The acquisition-variant catalog (`AcquisitionRequestDetail`)

| Variant | Provider-neutral fields | Domain examples |
|---|---|---|
| `external-procurement` | lines: description + quantity + unit, optional solution-line link and opaque external-party reference | construction materials; mechanical parts; electrical equipment |
| `internal-allocation` | opaque resource reference + quantity + unit, optional from-scope | internal crane allocation; internal compute capacity |
| `subscription-license` | optional opaque license reference + seats + term note | engineering suite licenses; analysis tooling |
| `cloud-service-provisioning` | service kind + capacity note | simulation clusters; CI fleets |
| `fabrication-request` | optional design reference + quantity + unit | steel bracing fabrication; machined assemblies |
| `specialist-capability-assignment` | opaque capability reference + optional assignee principal | welding inspection; commissioning specialists |
| `data-evidence-acquisition` | opaque subject reference | soil surveys; as-built documentation; telemetry access |

Procurement (`external-procurement`) is ONE entry — a domain-specific
acquisition projection, never the universal authority. A construction
pack maps its "procurement register" onto the catalog; a software pack
maps "cloud + licenses + data acquisition"; both use the SAME contract.

Fulfillment is a SEPARATE record (`AcquisitionFulfillmentRecord`)
referencing the request — request and answer stay distinguishable, with
typed rejections for dangling requests, cross-tenant fulfillment, double
fulfillment, and provider fields.

## The realization-variant catalog (`RealizationVariant`)

| Variant | Domain |
|---|---|
| `construction-build` | build / install (the construction "execution" projection) |
| `software-implementation-deployment` | implement / deploy / release |
| `mechanical-fabrication-assembly` | fabricate / assemble |
| `electrical-installation-commissioning` | install / commission |
| `manufacturing` | produce / batch |
| `infrastructure-provisioning` | provision / configure / migrate |
| `field-service-repair` | inspect / repair / maintain |

Every work package declares exactly one realization variant; activities
may override it (mixed-mode packages). The `foldRealizationVariants`
projection summarizes the mix — the input of the Navigator's realization
view.

## Provider neutrality

External systems stay behind the seam: outbound
`ExternalRequestEnvelope` (kinds: acquisition-order, information-request,
status-check, alert) and inbound `ExternalEventEnvelope` (kinds:
observation-report, status-update, acknowledgment), correlated by opaque
keys, with `externalEventToObservation` as the reference adapter step
(observation-reports become sealed observation records — evidence
capture; the actualization path still requires acceptance). This is the
seam W042 later bridges to concrete external bridges.

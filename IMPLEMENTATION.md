# Epoch Implementation Guide

Intended monorepo:
apps/web
apps/desktop
apps/mobile
packages/*
services/*
packs/*
adapters/*
runtimes/wasm
spec
docs
scripts

Dependency direction:
contracts -> implementations -> adapters.
Experience -> contracts/runtime, never reverse.
Packs -> contracts/capability APIs.
Providers never become semantic authorities.

Testing: package unit -> protocol contract -> integration -> reference E2E.
Generated artifacts have one owning Work Order.

Universal lifecycle: Understand -> Decide -> Plan -> Acquire -> Realize -> Observe/Actualize -> Verify -> Forecast -> Close -> Learn. `spec/universal-solution-lifecycle.md` is the canonical lifecycle guide; `spec/domain-pack-contract.md` defines domain specialization; `spec/solution-navigator-architecture.md` defines the synchronized UX projection.

Domain implementation rule: construction BOQ, software roadmap, mechanical BOM, electrical commissioning schedule and future domain schedules are projections of the same SolutionPackage/SolutionVersion/DeliveryRecord/ProgramOfWork graph. Procurement is an acquisition specialization; execution is a realization specialization.

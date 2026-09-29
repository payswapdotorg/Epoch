# W045 — Autonomous Role & Capability Discovery

Status: AUTHORIZED (base 8569b09a, 2026-09-29)
Wave: successor architecture
Depends On: W002, W003, W004, W006, W007, W009, W010, W011, W020
Worker Count: 1

## Objective

Implement the universal Role & Capability Discovery Plane described by ACR-004.

## Required outcomes

- canonical CapabilityDemand and RoleProposal contracts;
- task/problem evidence → capability-gap compiler;
- reusable role templates and domain-pack demand bindings;
- candidate agent/human/service resolution;
- model/substrate candidate resolution through provider-neutral capability contracts;
- organization composition and evaluation inputs;
- reproducible discovery-run lineage;
- capability-gap lifecycle;
- ecosystem discovery scheduler contract;
- source-adapter interface for public/private catalogs;
- safe candidate ingestion/profile/sandbox boundary;
- promotion gate from discovered → evaluated → verified/available;
- proposal mechanism for adapters/extensions/new domain packs;
- no hard-coded model/provider-to-role mappings;
- explicit tenant/authorization/security controls;
- tests for cross-domain role discovery using at least construction and software fixtures;
- tests proving external discovery cannot grant execution authority or mutate canonical state.

## Non-goals

- building provider-specific adapters for every external source;
- automatically activating arbitrary third-party models;
- replacing the Capability Registry;
- replacing the Agent Protocol;
- creating a domain-specific organization compiler;
- silently changing the active architecture lock.

## Owned write surfaces

- packages/capability-discovery/*
- services/capability-discovery/*
- contracts/capability-discovery/*
- docs/capability-discovery/*

## Acceptance

1. From only task/world/evidence/constraint input, the system can produce a provider-neutral set of CapabilityDemand records.
2. The system can synthesize candidate roles without a predefined role/model pair.
3. Existing Agent registrations, human declarations and model capabilities can be compared against role demands.
4. Candidate organizations can be evaluated using declared objective/constraint/evidence criteria.
5. A missing capability becomes an explicit CapabilityGap and can trigger ecosystem discovery.
6. A discovered external model remains non-consequential until sandbox/profile/evaluation/policy gates pass.
7. Domain packs contribute reusable templates but cannot become a second compiler authority.
8. Every discovery result is reproducible and content-addressed.
9. Security and authorization remain outside model prompts.
10. CI, governance, boundary, typecheck, lint, test and build pass.

## Scheduling

The discovery workflow should support a weekly default cadence and event-driven runs. The scheduler is deployment-neutral: Temporal schedules or another authorized scheduler may invoke the same provider-neutral service contract. A GitHub/Hugging Face source adapter is not the scheduler and is never a kernel dependency.

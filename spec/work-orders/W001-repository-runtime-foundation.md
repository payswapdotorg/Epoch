# W001 — Repository & Runtime Foundation
Status: AUTHORIZED
Wave: W0
Depends On: none
Worker Count: 1
Dispatch branch: work/W001-repository-runtime-foundation
Dispatch base: determined from main at dispatch; record the exact SHA in the live GitHub issue and PR.

## Objective
Establish the buildable monorepo, CI/governance runtime, and package-boundary checks every later Work Order consumes.

## Owned write surfaces
package.json
pnpm-workspace.yaml
turbo.json
tsconfig*.json
apps/**
packages/**
services/**
packs/**
scripts/**
.github/**

## Required architecture
TypeScript-first workspace. Reserve apps/web for Next.js/React, apps/desktop and apps/mobile for Tauri 2 shells, and maintain kernel -> experience -> pack boundaries. Freeze the dependency baseline needed by W002-W004.

## Acceptance
1. Fresh checkout can install and execute standardized check/build/test/typecheck entrypoints.
2. Workspace boundaries match IMPLEMENTATION.md.
3. CI invokes governance/typecheck/lint/test entrypoints.
4. Governance checker detects invalid worker counts, missing canonical files, and overlapping active Work Order ownership.
5. Package boundaries prevent kernel -> UI imports.
6. Dependency baseline for W002-W004 is frozen and documented so their branches do not edit root manifests/lockfiles.
7. No domain feature behavior is introduced.

## Exclusions
No World Model, agent, constraints, adapters, UI features, marketplace, or domain packs.

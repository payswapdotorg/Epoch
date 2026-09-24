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

#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
required=["AGENTS.md","AI_CONTINUATION.md","docs/LLM-ARCHITECT-HANDOFF.md","spec/PROJECT-STATE.md","spec/architecture.md","spec/architecture-lock.md","spec/requirements.md","spec/work-items.md","spec/dependency-graph.md","spec/worker-runbook.md"]
missing=[p for p in required if not (root/p).exists()]
if missing: sys.exit("governance-check FAIL: "+",".join(missing))
state=json.loads((root/"spec/development-state/program-state.json").read_text())
frontier=json.loads((root/"spec/development-state/frontier-state.json").read_text())
if state.get("maxConcurrentWorkers")!=3: sys.exit("maxConcurrentWorkers must be 3")
if len(frontier.get("inFlight",[]))>3: sys.exit("more than 3 workers in flight")
if not set(frontier["inFlight"]).issubset(set(state["active"])): sys.exit("inFlight must be active")
if "W001" not in (root/"spec/work-items.md").read_text(): sys.exit("W001 missing")
print("governance-check: PASS")

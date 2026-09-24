#!/usr/bin/env python3
"""Epoch governance checker.

W001 baseline checks (preserved from the bootstrap version):
  - required canonical files exist;
  - maxConcurrentWorkers is sane and inFlight ⊆ active with at most 3 ids;
  - W001 appears in spec/work-items.md.

W001 extensions (acceptance 4):
  1. Required canonical files extended with IMPLEMENTATION.md, the four
     spec/development-state/*.json files, spec/worker-runbook.md, and every
     spec/work-orders/W*.md referenced by the dependency graph
     (spec/development-state/dependency-state.json, the spec/work-items.md
     ownership table, and the active/inFlight state).
  2. Worker-count governance: maxConcurrentWorkers must be an integer in
     1..3; authorized (active ∪ inFlight) work-order files must declare
     "Worker Count: 1"; any other work-order file declaring a different
     worker count is also invalid (the Epoch dispatch model is one worker
     per Work Order).
  3. Overlapping active ownership: owned-surfaces sets parsed from the
     spec/work-items.md table must be pairwise disjoint across all
     active/inFlight Work Orders; the exact intersecting paths are reported.

Deterministic, stdlib-only, runs in CI on every push.

Usage:
  python3 scripts/governance-check.py [--root DIR] [--selftest]

--selftest runs the negative-fixture battery (reproducible evidence that each
mutation class is detected: invalid worker count, missing canonical file,
missing referenced work-order file, overlapping ownership).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import sys
import tempfile

REQUIRED_FILES = [
    "AGENTS.md",
    "AI_CONTINUATION.md",
    "IMPLEMENTATION.md",
    "README.md",
    "docs/LLM-ARCHITECT-HANDOFF.md",
    "spec/PROJECT-STATE.md",
    "spec/architecture.md",
    "spec/architecture-lock.md",
    "spec/requirements.md",
    "spec/work-items.md",
    "spec/dependency-graph.md",
    "spec/worker-runbook.md",
    "spec/development-state/program-state.json",
    "spec/development-state/frontier-state.json",
    "spec/development-state/dependency-state.json",
    "spec/development-state/checkpoint-state.json",
]

WORK_ORDER_FILE_RE = re.compile(r"^W\d{3}-.*\.md$")
WORK_ORDER_ID_RE = re.compile(r"^W\d{3}$")
WORKER_COUNT_RE = re.compile(r"^Worker\s+Count\s*:\s*(\d+)\s*$", re.MULTILINE)


def default_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[1]


def read_json(root: pathlib.Path, relpath: str):
    return json.loads((root / relpath).read_text(encoding="utf-8"))


def read_text(root: pathlib.Path, relpath: str) -> str:
    return (root / relpath).read_text(encoding="utf-8")


def work_order_files(root: pathlib.Path) -> dict:
    """Map work-order id -> path for every spec/work-orders/W###-*.md file."""
    wo_dir = root / "spec" / "work-orders"
    if not wo_dir.is_dir():
        return {}
    return {
        p.name.split("-", 1)[0]: p for p in sorted(wo_dir.iterdir()) if WORK_ORDER_FILE_RE.match(p.name)
    }


def dependency_graph_ids(root: pathlib.Path) -> set:
    """All Work Order ids referenced by spec/development-state/dependency-state.json."""
    try:
        dep = read_json(root, "spec/development-state/dependency-state.json")
    except (OSError, json.JSONDecodeError):
        return set()
    ids: set = set()

    def walk(node) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if isinstance(key, str) and WORK_ORDER_ID_RE.match(key):
                    ids.add(key)
                walk(value)
        elif isinstance(node, list):
            for value in node:
                if isinstance(value, str) and WORK_ORDER_ID_RE.match(value):
                    ids.add(value)
                else:
                    walk(value)

    walk(dep)
    return ids


def parse_work_items(root: pathlib.Path) -> dict:
    """Parse the spec/work-items.md ownership table: id -> [owned surfaces]."""
    owned: dict = {}
    text = read_text(root, "spec/work-items.md")
    for line in text.splitlines():
        match = re.match(r"^\|\s*(W\d{3})\s*\|", line)
        if not match:
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 4 or cells[0] != match.group(1):
            continue
        surfaces = [s.strip() for s in cells[3].split(",") if s.strip()]
        owned[match.group(1)] = surfaces
    return owned


def authorized_ids(root: pathlib.Path) -> set:
    """Work Orders currently authorized: program-state active ∪ frontier inFlight."""
    program = read_json(root, "spec/development-state/program-state.json")
    frontier = read_json(root, "spec/development-state/frontier-state.json")
    active = {str(x) for x in program.get("active", [])}
    in_flight = {str(x) for x in frontier.get("inFlight", [])}
    return active | in_flight


def worker_count_of(path: pathlib.Path):
    match = WORKER_COUNT_RE.search(path.read_text(encoding="utf-8"))
    return int(match.group(1)) if match else None


def run_checks(root: pathlib.Path) -> list:
    """Return the list of governance failure messages (empty list = PASS)."""
    failures: list = []

    # --- 1) canonical files -------------------------------------------------
    missing = [p for p in REQUIRED_FILES if not (root / p).exists()]
    wo_files = work_order_files(root)
    referenced = dependency_graph_ids(root) | set(parse_work_items(root).keys()) | authorized_ids(root)
    missing_wo = sorted(wo for wo in referenced if wo not in wo_files)
    if missing:
        failures.append("missing canonical files: " + ", ".join(missing))
    if missing_wo:
        failures.append(
            "work-order files referenced by the dependency graph are missing: " + ", ".join(missing_wo)
        )

    # --- 2) worker counts ---------------------------------------------------
    state = read_json(root, "spec/development-state/program-state.json")
    frontier = read_json(root, "spec/development-state/frontier-state.json")
    max_workers = state.get("maxConcurrentWorkers")
    if not isinstance(max_workers, int) or isinstance(max_workers, bool) or not 1 <= max_workers <= 3:
        failures.append(f"maxConcurrentWorkers must be an integer in 1..3 (got {max_workers!r})")
    in_flight = [str(x) for x in frontier.get("inFlight", [])]
    if len(in_flight) > 3:
        failures.append("more than 3 workers in flight")
    if not set(in_flight).issubset({str(x) for x in state.get("active", [])}):
        failures.append("inFlight must be a subset of active")

    authorized = authorized_ids(root)
    for wo, wo_path in sorted(wo_files.items()):
        declared = worker_count_of(wo_path)
        if wo in authorized:
            if declared is None:
                failures.append(
                    f"authorized work order {wo} ({wo_path.name}) does not declare 'Worker Count: 1'"
                )
            elif declared != 1:
                failures.append(
                    f"authorized work order {wo} ({wo_path.name}) declares Worker Count: {declared}; must be 1"
                )
        elif declared is not None and declared != 1:
            failures.append(
                f"work order {wo} ({wo_path.name}) declares Worker Count: {declared}; "
                "the Epoch dispatch model requires 1 worker per Work Order"
            )

    # --- 3) baseline bootstrap sanity ---------------------------------------
    if "W001" not in read_text(root, "spec/work-items.md"):
        failures.append("W001 missing from spec/work-items.md")

    # --- 4) pairwise-disjoint owned surfaces for active/inFlight work orders -
    owned = parse_work_items(root)
    active_ids = sorted(authorized)
    for wo in active_ids:
        if wo not in owned:
            failures.append(
                f"active/inFlight work order {wo} has no owned-surfaces row in spec/work-items.md"
            )
    for i in range(len(active_ids)):
        for j in range(i + 1, len(active_ids)):
            a, b = active_ids[i], active_ids[j]
            intersection = sorted(set(owned.get(a, [])) & set(owned.get(b, [])))
            if intersection:
                failures.append(
                    f"overlapping owned surfaces between {a} and {b}: {', '.join(intersection)}"
                )

    return failures


# --------------------------------------------------------------------------------
# Negative-fixture self-test battery (reproducible evidence for acceptance 4).
# --------------------------------------------------------------------------------

FIXTURE_FILES = {
    "README.md": "# fixture\n",
    "AGENTS.md": "# fixture agents\n",
    "AI_CONTINUATION.md": "# fixture continuation\n",
    "IMPLEMENTATION.md": "# fixture implementation\n",
    "docs/LLM-ARCHITECT-HANDOFF.md": "# fixture handoff\n",
    "spec/PROJECT-STATE.md": "# fixture project state\n",
    "spec/architecture.md": "# fixture architecture\n",
    "spec/architecture-lock.md": "# fixture architecture lock\n",
    "spec/requirements.md": "# fixture requirements\n",
    "spec/dependency-graph.md": "# fixture dependency graph\n",
    "spec/worker-runbook.md": "# fixture runbook\n",
    "spec/work-items.md": (
        "# Fixture work items\n\n"
        "One Work Order = one branch = one PR. Worker count = 1.\n\n"
        "| ID | Scope | Depends | Owned surfaces |\n"
        "|---|---|---|---|\n"
        "| W001 | Fixture foundation | — | root manifests, scripts/* |\n"
        "| W002 | Fixture alpha | W001 | packages/alpha/* |\n"
        "| W003 | Fixture beta | W001 | packages/beta/* |\n"
    ),
    "spec/development-state/program-state.json": json.dumps(
        {
            "architectureVersion": "E1.0",
            "experienceVersion": "X1.0",
            "workOrderVersion": "WO1.0",
            "defaultBranch": "main",
            "maxConcurrentWorkers": 3,
            "active": ["W001", "W002", "W003"],
            "completed": [],
            "blocked": [],
            "lastMergeSha": "0" * 40,
        }
    ),
    "spec/development-state/frontier-state.json": json.dumps(
        {
            "eligible": ["W001"],
            "inFlight": ["W001"],
            "blocked": [],
            "maxConcurrentWorkers": 3,
        }
    ),
    "spec/development-state/dependency-state.json": json.dumps(
        {"W0": ["W001"], "W1": ["W002", "W003"]}
    ),
    "spec/development-state/checkpoint-state.json": json.dumps(
        {"baselineSha": "0" * 40, "status": "SELFTEST", "next": "selftest"}
    ),
    "spec/work-orders/W001-fixture-foundation.md": (
        "# W001 — Fixture Foundation\nStatus: AUTHORIZED\nWave: W0\nDepends On: none\n"
        "Worker Count: 1\nDispatch branch: work/W001-fixture-foundation\n"
    ),
    "spec/work-orders/W002-fixture-alpha.md": (
        "# W002 — Fixture Alpha\nStatus: READY_AFTER_DEPENDENCIES\nDepends On: W001\nWorker Count: 1\n"
    ),
    "spec/work-orders/W003-fixture-beta.md": (
        "# W003 — Fixture Beta\nStatus: READY_AFTER_DEPENDENCIES\nDepends On: W001\nWorker Count: 1\n"
    ),
}


def build_fixture(base: pathlib.Path) -> None:
    for relpath, content in FIXTURE_FILES.items():
        target = base / relpath
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def mutate_copy(src: pathlib.Path) -> pathlib.Path:
    dst = pathlib.Path(tempfile.mkdtemp(prefix="epoch-gov-case-"))
    shutil.copytree(src, dst, dirs_exist_ok=True)
    return dst


def rewrite_json(root: pathlib.Path, relpath: str, updates: dict) -> None:
    p = root / relpath
    data = json.loads(p.read_text(encoding="utf-8"))
    data.update(updates)
    p.write_text(json.dumps(data), encoding="utf-8")


def rewrite_text(root: pathlib.Path, relpath: str, fn) -> None:
    p = root / relpath
    p.write_text(fn(p.read_text(encoding="utf-8")), encoding="utf-8")


def selftest() -> int:
    scratch = [pathlib.Path(tempfile.mkdtemp(prefix="epoch-gov-valid-"))]
    try:
        valid = scratch[0]
        build_fixture(valid)

        cases = []

        problems = run_checks(valid)
        cases.append(("valid-baseline-passes", problems == [], problems))

        case = mutate_copy(valid)
        scratch.append(case)
        rewrite_json(case, "spec/development-state/program-state.json", {"maxConcurrentWorkers": 9})
        problems = run_checks(case)
        cases.append(
            (
                "invalid-max-concurrent-workers-detected",
                any("maxConcurrentWorkers" in p for p in problems),
                problems,
            )
        )

        case = mutate_copy(valid)
        scratch.append(case)
        (case / "spec/development-state/checkpoint-state.json").unlink()
        problems = run_checks(case)
        cases.append(
            (
                "missing-canonical-file-detected",
                any("checkpoint-state.json" in p for p in problems),
                problems,
            )
        )

        case = mutate_copy(valid)
        scratch.append(case)
        rewrite_text(
            case,
            "spec/work-items.md",
            lambda t: t.replace("packages/beta/*", "packages/alpha/*, packages/beta/*"),
        )
        problems = run_checks(case)
        cases.append(
            (
                "overlapping-ownership-detected",
                any("overlapping owned surfaces" in p and "packages/alpha/*" in p for p in problems),
                problems,
            )
        )

        case = mutate_copy(valid)
        scratch.append(case)
        rewrite_text(
            case,
            "spec/work-orders/W001-fixture-foundation.md",
            lambda t: t.replace("Worker Count: 1", "Worker Count: 2"),
        )
        problems = run_checks(case)
        cases.append(
            ("invalid-worker-count-detected", any("Worker Count: 2" in p for p in problems), problems)
        )

        case = mutate_copy(valid)
        scratch.append(case)
        (case / "spec/work-orders/W002-fixture-alpha.md").unlink()
        problems = run_checks(case)
        cases.append(
            (
                "missing-referenced-work-order-detected",
                any("W002" in p and "missing" in p for p in problems),
                problems,
            )
        )

        ok = True
        for name, passed, problems in cases:
            if passed:
                print(f"  selftest case '{name}': detected/valid as expected")
            else:
                ok = False
                print(f"  selftest case '{name}': UNEXPECTED RESULT")
                for problem in problems:
                    print(f"    - {problem}")
        print(f"governance selftest: {'PASS' if ok else 'FAIL'} ({len(cases)} cases)")
        return 0 if ok else 1
    finally:
        for d in scratch:
            shutil.rmtree(d, ignore_errors=True)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Epoch governance checker")
    parser.add_argument("--root", default=None, help="repository root to check (default: this checkout)")
    parser.add_argument("--selftest", action="store_true", help="run the negative-fixture self-test battery")
    args = parser.parse_args(argv)

    if args.selftest:
        return selftest()

    root = pathlib.Path(args.root).resolve() if args.root else default_root()
    try:
        failures = run_checks(root)
    except (OSError, json.JSONDecodeError, KeyError) as err:
        print(f"governance-check FAIL: cannot read governance state: {err}")
        return 1

    if failures:
        print("governance-check FAIL:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("governance-check: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Measurable value. Note: these are prototype instrumentation figures over seeded
demo data, not real-world benchmarks. In production a baseline is captured per
customer during the pilot and improvement is measured against it."""
from .store import store
from .states import State

# Illustrative only - the number a pilot would establish per customer, not a claim.
BASELINE_TOUCHES = 6.0

CLOSED = {State.RESOLVED.value, State.DENIED.value}


def compute() -> dict:
    cases = store.list_cases()
    total = len(cases)
    resolved = [c for c in cases if c.state == State.RESOLVED.value]   # filled + verified
    denied = [c for c in cases if c.state == State.DENIED.value]
    open_cases = [c for c in cases if c.state not in CLOSED]

    avg_touches = round(sum(c.touches for c in resolved) / len(resolved), 1) if resolved else 0.0

    durations = [
        (c.resolved_at - c.created_at).total_seconds() / 3600.0
        for c in resolved if c.resolved_at
    ]
    durations.sort()
    median_hrs = round(durations[len(durations) // 2], 1) if durations else 0.0

    auto_drafted = sum(1 for c in cases if c.draft)
    pct_auto = round(100 * auto_drafted / total) if total else 0

    return {
        "open_cases": len(open_cases),
        "urgent_open": sum(1 for c in open_cases if c.priority == "urgent"),
        "resolved_cases": len(resolved),
        "denied_cases": len(denied),
        "needs_human": sum(1 for c in cases if c.state == State.NEEDS_HUMAN.value),
        "avg_touches": avg_touches,
        "baseline_touches": BASELINE_TOUCHES,
        "touch_reduction_pct": round(100 * (BASELINE_TOUCHES - avg_touches) / BASELINE_TOUCHES) if resolved else 0,
        "median_resolution_hrs": median_hrs,
        "pct_auto_drafted": pct_auto,
    }

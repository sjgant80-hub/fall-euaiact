# fall-euaiact — specification

## Purpose

sovereign single-file browser tool · MIT · @ai-native-solutions

## Contract

- **complianceMap** — part of the fall-euaiact public surface; deterministic, total (never throws).
- **declare** — part of the fall-euaiact public surface; deterministic, total (never throws).
- **obligations** — part of the fall-euaiact public surface; deterministic, total (never throws).
- **tierOf** — part of the fall-euaiact public surface; deterministic, total (never throws).

## Guarantees

- **Deterministic** — the same input yields the same output on any machine, any run.
- **Total** — hostile or malformed input returns a defined value, never an exception.
- **Zero-dependency** — no third-party runtime code inside the trust boundary.

## Verification

The suite exercises the public surface directly and is mutation-checked: a change to any guarded line makes a
test fail. konomify admits fall-euaiact only when both the structure rubric (acg-assessor) and the behaviour gate
(witness) pass.

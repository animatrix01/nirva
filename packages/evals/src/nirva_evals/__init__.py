"""NIRVA evaluation harness.

Loads the golden dataset (Winning Plan §14 minimum benchmark set), executes each
case against the live retrieval stack, and computes the metric set:

- Recall@5 (document-level, role-ACL-filtered)
- Citation validity (cited sources must be retrieved sources)
- Grounded-answer rate (cite-cases produce findings with citations)
- Correct abstention rate (no-evidence cases abstain instead of guessing)
- Unauthorized-retrieval count (permission-boundary cases returning chunks —
  target: zero)
- Injection-block rate (injection cases fire blocked_injection — target: 100%)

The runner reports what it measures. Metrics are never invented.
"""

import glob
import json

path = sorted(glob.glob("packages/evals/results/results-*.json"))[-1]
data = json.loads(open(path, encoding="utf-8").read())

print("ABSTAIN cases (max retrieved score):")
for c in data["cases"]:
    if c["category"] == "abstention":
        scores = c.get("retrieved_scores") or []
        mx = max(scores) if scores else 0.0
        print(f'  {c["case_id"]:12} max={mx:.3f} | {c["question"][:50]}')

print()
print("RELEVANT cases (lowest max score):")
rows = []
for c in data["cases"]:
    if c["category"] == "abstention":
        continue
    scores = c.get("retrieved_scores") or []
    if scores:
        rows.append((max(scores), c["case_id"], c["category"]))
rows.sort()
for mx, cid, cat in rows[:6]:
    print(f'  {mx:.3f} {cid} [{cat}]')

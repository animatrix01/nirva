import json
import sqlite3

conn = sqlite3.connect(r"apps\api\_server.db")
rows = conn.execute(
    "SELECT job_id, chunk_id, payload FROM job_evidence ORDER BY id DESC LIMIT 20"
).fetchall()
jobs: dict[str, list[tuple[str, str]]] = {}
for job_id, chunk_id, payload in rows:
    jobs.setdefault(job_id, []).append((chunk_id, json.loads(payload).get("source")))
latest = max(jobs.keys())
print("latest job with evidence snapshot:", latest[:8])
for chunk_id, source in jobs[latest]:
    print(f"  {chunk_id:34} [{source}]")
conn.close()

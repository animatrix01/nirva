import sqlite3

conn = sqlite3.connect(r"apps\api\_server.db")
row = conn.execute(
    "SELECT id, status, decided_by, work_order_id, job_id FROM approvals "
    "WHERE id LIKE '2438ea20%'"
).fetchone()
if row:
    print("approval:", row[0][:8], "| status:", row[1], "| decided_by:", (row[2] or "none")[:8], "| wo:", row[3])
    job = conn.execute("SELECT status FROM jobs WHERE id=?", (row[4],)).fetchone()
    print("job status:", job[0] if job else "missing")
else:
    print("approval not found")
recent = conn.execute(
    "SELECT id, status, work_order_id FROM approvals ORDER BY requested_at DESC LIMIT 3"
).fetchall()
print("--- recent approvals:")
for r in recent:
    print(" ", r[0][:8], r[1], r[2])
conn.close()

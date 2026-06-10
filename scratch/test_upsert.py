import psycopg2
import urllib.request
import urllib.error
import json

# DB connection
conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
cur = conn.cursor()

# Insert test record
TEST_ID = 'test-upsert-9999'
cur.execute("DELETE FROM mentions WHERE mention_id = %s;", (TEST_ID,))
cur.execute("""
    INSERT INTO mentions (mention_id, full_name, first_name, last_name, race, county)
    VALUES (%s, 'Test Full Name', 'Test First', 'Test Last', 'W', 'Test County');
""", (TEST_ID,))
conn.commit()
print("Inserted test mention record.")

# Check initial record
cur.execute("SELECT full_name, norm_first_name FROM mentions WHERE mention_id = %s;", (TEST_ID,))
row = cur.fetchone()
print("Initial record:", row)

# Perform upsert via PostgREST proxy
URL = "http://localhost:8000/pgrst/mentions"
JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg'
headers = {
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
    "Authorization": f"Bearer {JWT_TOKEN}"
}

payload = [{
    "mention_id": TEST_ID,
    "norm_first_name": "TEST_NORMALIZED_FIRST"
}]

req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print("PostgREST response status:", response.status)
except urllib.error.HTTPError as e:
    print("PostgREST HTTPError:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("PostgREST Error:", e)

# Fetch from DB to verify if other fields are preserved
cur.execute("SELECT full_name, norm_first_name, county FROM mentions WHERE mention_id = %s;", (TEST_ID,))
final_row = cur.fetchone()
print("Final record after upsert:", final_row)

# Clean up
cur.execute("DELETE FROM mentions WHERE mention_id = %s;", (TEST_ID,))
conn.commit()
cur.close()
conn.close()

if final_row and final_row[0] == 'Test Full Name' and final_row[1] == 'TEST_NORMALIZED_FIRST' and final_row[2] == 'Test County':
    print("SUCCESS: PostgREST resolution=merge-duplicates is safe and performs a selective column update!")
else:
    print("FAILURE: Columns were lost or modified incorrectly.")

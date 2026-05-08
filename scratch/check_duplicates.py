import requests
import json

POSTGREST_URL = 'http://localhost:3000'
JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg'
HEADERS = {
    'Authorization': f'Bearer {JWT_TOKEN}'
}

def check_duplicates():
    # Query to find duplicate assertions (subject_id, predicate, object_id/object_string)
    # We can use PostgREST's grouping if supported, but it's easier to fetch and check.
    # Actually, let's just fetch a sample or use a clever query.
    
    # Let's try to get counts of (subject_id, predicate, object_id)
    # PostgREST doesn't support GROUP BY directly in the simple API.
    # But we can fetch all and do it in Python.
    
    all_assertions = []
    offset = 0
    limit = 5000
    while True:
        url = f"{POSTGREST_URL}/assertions?select=subject_id,predicate,object_id,object_string&limit={limit}&offset={offset}"
        res = requests.get(url, headers=HEADERS)
        data = res.json()
        if not data:
            break
        all_assertions.extend(data)
        if len(data) < limit:
            break
        offset += limit
        print(f"Fetched {len(all_assertions)} assertions...")

    groups = {}
    for a in all_assertions:
        obj = a['object_id'] or a['object_string'] or 'null'
        key = (a['subject_id'], a['predicate'], obj)
        groups[key] = groups.get(key, 0) + 1
    
    duplicates = {k: v for k, v in groups.items() if v > 1}
    print(f"Found {len(duplicates)} groups with duplicates.")
    for k, v in list(duplicates.items())[:10]:
        print(f"Key {k}: {v} occurrences")

if __name__ == "__main__":
    check_duplicates()

import urllib.request
import urllib.error
import json

URL = "http://localhost:3000"

p_id = "df4a293a-1ad2-4b8c-a50d-a7616279eab9"
c1_id = "d45bdefd-c01b-445c-8e21-9b3d78a57ec5"
c2_id = "c5257db1-1922-4f03-9ec6-91ebdd928ced"
gc_id = "18e6a59e-e392-4e00-b3df-c5851308527e"

ids = f"{p_id},{c1_id},{c2_id},{gc_id}"
req = urllib.request.Request(f"{URL}/assertions?subject_id=in.({ids})&select=subject_id,predicate,object_id,who")

try:
    with urllib.request.urlopen(req) as response:
        assertions = json.loads(response.read().decode('utf-8'))
except urllib.error.URLError as e:
    print("Failed to fetch assertions:", e)
    exit(1)

def get_name(id):
    if id == p_id: return "Parent P"
    if id == c1_id: return "Child C1"
    if id == c2_id: return "Child C2"
    if id == gc_id: return "Grandchild GC"
    return "Unknown"

print(f"Total assertions involving our test subjects: {len(assertions)}")
for a in assertions:
    subj = get_name(a['subject_id'])
    obj = get_name(a['object_id'])
    pred = a['predicate']
    who = a['who']
    print(f"- [{who}] {subj} {pred} {obj}")

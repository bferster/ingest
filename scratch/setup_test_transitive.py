import urllib.request
import urllib.error
import json
import time

URL = "http://localhost:3000"
headers = {"Content-Type": "application/json", "Prefer": "return=representation"}

print("Creating dummy mentions for test...")
mentions_data = [
    {"full_name": "Test Parent P"},
    {"full_name": "Test Child C1"},
    {"full_name": "Test Child C2"},
    {"full_name": "Test Grandchild GC"}
]

req = urllib.request.Request(f"{URL}/mentions", data=json.dumps(mentions_data).encode('utf-8'), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        mentions = json.loads(response.read().decode('utf-8'))
except urllib.error.URLError as e:
    print("Failed to create mentions:", e)
    exit(1)

p_id = mentions[0]["mention_id"]
c1_id = mentions[1]["mention_id"]
c2_id = mentions[2]["mention_id"]
gc_id = mentions[3]["mention_id"]

print(f"Parent ID: {p_id}")
print(f"Child 1 ID: {c1_id}")
print(f"Child 2 ID: {c2_id}")
print(f"Grandchild ID: {gc_id}")

print("\nCreating assertions...")
assertions_data = [
    {"subject_id": c1_id, "predicate": "isChildOf", "object_id": p_id, "who": "test_script", "confidence": 1.0},
    {"subject_id": c2_id, "predicate": "isChildOf", "object_id": p_id, "who": "test_script", "confidence": 1.0},
    {"subject_id": c1_id, "predicate": "isParentOf", "object_id": gc_id, "who": "test_script", "confidence": 1.0}
]

req2 = urllib.request.Request(f"{URL}/assertions", data=json.dumps(assertions_data).encode('utf-8'), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req2) as response:
        assertions = json.loads(response.read().decode('utf-8'))
except urllib.error.URLError as e:
    print("Failed to create assertions:", e)
    exit(1)

print("Test assertions created successfully!")
print("Please go to your web application, click 'Expand assertions', and then I will fetch the new expanded assertions.")

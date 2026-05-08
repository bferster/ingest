import urllib.request
import urllib.error
import json

URL = "http://localhost:3000/assertions"
headers = {"Content-Type": "application/json", "Prefer": "return=representation"}

payload = [{
    "subject_id": "d45bdefd-c01b-445c-8e21-9b3d78a57ec5",
    "predicate": "isParentOf",
    "object_id": "df4a293a-1ad2-4b8c-a50d-a7616279eab9",
    "who": "expanded",
    "confidence": 1.0
}]

req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print("Success:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print(e.read().decode('utf-8'))
except urllib.error.URLError as e:
    print("URLError:", e.reason)

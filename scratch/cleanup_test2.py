import urllib.request
import urllib.parse
import urllib.error

URL = "http://localhost:3000"

req = urllib.request.Request(f"{URL}/assertions?who=eq.expanded", method="DELETE")
try:
    urllib.request.urlopen(req)
    print("Deleted expanded assertions.")
except Exception as e:
    print(e)

# 2. Find mentions with full_name starting with "Test "
names = "Test Parent P,Test Child C1,Test Child C2,Test Grandchild GC"
encoded_names = urllib.parse.quote(names)
req = urllib.request.Request(f"{URL}/mentions?full_name=in.({encoded_names})", method="DELETE")
try:
    urllib.request.urlopen(req)
    print("Deleted test mentions.")
except Exception as e:
    print(e)

print("Cleanup complete.")

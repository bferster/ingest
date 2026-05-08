import urllib.request
import urllib.error

URL = "http://localhost:3000"

# 1. First delete any assertions related to the test mentions or where who=test_script
req = urllib.request.Request(f"{URL}/assertions?who=eq.test_script", method="DELETE")
try:
    urllib.request.urlopen(req)
    print("Deleted test_script assertions.")
except Exception as e:
    print(e)

# 2. Find mentions with full_name starting with "Test "
names = "Test Parent P,Test Child C1,Test Child C2,Test Grandchild GC"
req = urllib.request.Request(f"{URL}/mentions?full_name=in.({names})", method="DELETE")
try:
    urllib.request.urlopen(req)
    print("Deleted test mentions.")
except Exception as e:
    print(e)

print("Cleanup complete.")

import subprocess
try:
    res = subprocess.run(['node', '-c', 'app.js'], capture_output=True, text=True)
    if res.returncode == 0:
        print("Syntax check passed: No syntax errors in app.js")
    else:
        print("Syntax check failed:")
        print(res.stderr)
except Exception as e:
    print(f"Error running syntax check: {e}")

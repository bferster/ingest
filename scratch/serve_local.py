import http.server
import socketserver
import os
import sys
import json
import datetime

PORT = 8000
DIRECTORY = os.getcwd()
ENV_PATH = os.path.join(os.path.dirname(__file__), '..', 'env', '.env')

def load_jwt_secret():
    """Load JWT_SECRET from env/.env"""
    try:
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if line.startswith('JWT_SECRET='):
                    return line.split('=', 1)[1]
    except FileNotFoundError:
        pass
    return None

def generate_token(secret, role='authenticated_user', expiry_hours=24):
    """Generate a JWT token using PyJWT."""
    import jwt
    payload = {
        'role': role,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=expiry_hours)
    }
    return jwt.encode(payload, secret, algorithm='HS256')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def handle_proxy(self):
        import urllib.request
        import urllib.error
        
        target_path = self.path[6:] # Strip '/pgrst'
        target_url = f"http://localhost:3000{target_path}"
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None
        
        headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ('host', 'content-length'):
                headers[key] = val
                
        method = self.command
        req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)
                for key, val in response.headers.items():
                    if key.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for key, val in e.headers.items():
                if key.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(key, val)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_GET(self):
        if self.path.startswith('/pgrst/'):
            self.handle_proxy()
            return
        # Serve a JWT token at /api/token
        if self.path == '/api/token':
            secret = load_jwt_secret()
            if secret:
                token = generate_token(secret)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'token': token}).encode())
            else:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'JWT_SECRET not found in env/.env'}).encode())
            return
        
        # Default: serve static files
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/pgrst/'):
            self.handle_proxy()
            return
        self.send_response(404)
        self.end_headers()

    def do_PATCH(self):
        if self.path.startswith('/pgrst/'):
            self.handle_proxy()
            return
        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        if self.path.startswith('/pgrst/'):
            self.handle_proxy()
            return
        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        if self.path.startswith('/pgrst/'):
            self.handle_proxy()
            return
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

def run():
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"--- Local Web Server Started ---")
            print(f"Serving files from: {DIRECTORY}")
            print(f"Access your test page at: http://localhost:{PORT}/ops/testDBaccess.htm")
            print(f"Token endpoint: http://localhost:{PORT}/api/token")
            print(f"Press Ctrl+C to stop.")
            httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server: {e}")

if __name__ == "__main__":
    # If a directory is passed as an argument, use it
    if len(sys.argv) > 1:
        if os.path.isdir(sys.argv[1]):
            DIRECTORY = sys.argv[1]
    
    run()

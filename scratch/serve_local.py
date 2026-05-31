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

    def do_GET(self):
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

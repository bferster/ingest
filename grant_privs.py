import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated_user;")
    cur.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated_user;")
    print("Granted privileges to authenticated_user")
except Exception as e:
    print(f"Error: {e}")

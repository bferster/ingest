import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("GRANT USAGE ON SCHEMA public TO authenticated_user;")
    cur.execute("GRANT USAGE ON SCHEMA public TO myuser;")
    cur.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated_user;")
    cur.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated_user;")
    
    # Also grant to 'myuser' if it's the anon role
    cur.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myuser;")
    cur.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myuser;")
    
    # Check if we can insert as authenticated_user
    conn_test = psycopg2.connect('postgresql://authenticated_user:1990noVe!@localhost:5432/verite')
    cur_test = conn_test.cursor()
    cur_test.execute("SELECT has_table_privilege('authenticated_user', 'mentions', 'INSERT');")
    print(f"Has insert privilege: {cur_test.fetchone()[0]}")
    
    print("Granted USAGE and privileges.")
except Exception as e:
    print(f"Error: {e}")

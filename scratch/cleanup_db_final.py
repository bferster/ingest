import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DELETE FROM mentions WHERE source = '{}';")
    print(f"Deleted {cur.rowcount} records with corrupted source name.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")

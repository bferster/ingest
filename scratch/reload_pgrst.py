import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("NOTIFY pgrst, 'reload schema';")
    print("PostgREST schema cache reload signal sent.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")

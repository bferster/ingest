import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    cur = conn.cursor()
    cur.execute("SELECT mention_id, source, source_year, full_name FROM mentions ORDER BY created DESC LIMIT 5;")
    for row in cur.fetchall():
        print(row)
except Exception as e:
    print(f"Error: {e}")

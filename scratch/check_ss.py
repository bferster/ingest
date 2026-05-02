import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    cur = conn.cursor()
    cur.execute("SELECT source, count(*) FROM mentions WHERE source LIKE 'ALB_SS%' GROUP BY source")
    print("Slave Schedule sources in DB:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]} records")
    conn.close()
except Exception as e:
    print(f"Error: {e}")

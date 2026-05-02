import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    
    # Check for corrupted source strings
    cur.execute("SELECT count(*) FROM mentions WHERE source LIKE '%object Promise%';")
    count = cur.fetchone()[0]
    print(f"Found {count} corrupted mentions.")
    
    if count > 0:
        cur.execute("DELETE FROM mentions WHERE source LIKE '%object Promise%';")
        print("Deleted corrupted records.")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")

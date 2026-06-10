import psycopg2
conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
cur = conn.cursor()
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
""")
print(cur.fetchall())

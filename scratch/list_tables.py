import psycopg2
conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'assertions';
""")
print(cur.fetchall())


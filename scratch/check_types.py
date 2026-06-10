import psycopg2
conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
cur = conn.cursor()
cur.execute("""
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE column_name IN ('mention_id', 'subject_id', 'object_id')
""")
print(cur.fetchall())

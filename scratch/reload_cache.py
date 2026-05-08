import psycopg2
conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
conn.autocommit = True
cur = conn.cursor()
cur.execute("NOTIFY pgrst, 'reload schema';")
print("NOTIFY sent")

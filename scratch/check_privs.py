import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    cur = conn.cursor()
    cur.execute("""
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'mentions' AND grantee = 'authenticated_user';
    """)
    print("Privileges for authenticated_user on mentions:")
    for row in cur.fetchall():
        print(f"  {row[1]}")
    
    cur.execute("""
        SELECT grantee, privilege_type 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'assertions' AND grantee = 'authenticated_user';
    """)
    print("Privileges for authenticated_user on assertions:")
    for row in cur.fetchall():
        print(f"  {row[1]}")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")

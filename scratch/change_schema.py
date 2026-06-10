import psycopg2
try:
    conn = psycopg2.connect('postgresql://verite_admin:1990noVe!@localhost:5432/verite')
    conn.autocommit = True
    cur = conn.cursor()
    
    print("Dropping foreign key constraints...")
    cur.execute("ALTER TABLE mentions DROP CONSTRAINT IF EXISTS mentions_enslaver_id_fkey;")
    cur.execute("ALTER TABLE assertions DROP CONSTRAINT IF EXISTS assertions_subject_id_fkey;")
    cur.execute("ALTER TABLE assertions DROP CONSTRAINT IF EXISTS assertions_object_id_fkey;")
    
    print("Altering column types...")
    # Change mentions table columns
    cur.execute("ALTER TABLE mentions ALTER COLUMN mention_id TYPE VARCHAR(100);")
    cur.execute("ALTER TABLE mentions ALTER COLUMN mention_id DROP DEFAULT;")
    cur.execute("ALTER TABLE mentions ALTER COLUMN enslaver_id TYPE VARCHAR(100);")
    
    # Change assertions table columns
    cur.execute("ALTER TABLE assertions ALTER COLUMN subject_id TYPE VARCHAR(100);")
    cur.execute("ALTER TABLE assertions ALTER COLUMN object_id TYPE VARCHAR(100);")
    
    print("Re-creating foreign key constraints...")
    cur.execute("ALTER TABLE mentions ADD CONSTRAINT mentions_enslaver_id_fkey FOREIGN KEY (enslaver_id) REFERENCES mentions(mention_id);")
    
    # Re-create foreign keys on assertions since subject_id/object_id reference mentions(mention_id)
    cur.execute("ALTER TABLE assertions ADD CONSTRAINT assertions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES mentions(mention_id);")
    cur.execute("ALTER TABLE assertions ADD CONSTRAINT assertions_object_id_fkey FOREIGN KEY (object_id) REFERENCES mentions(mention_id);")
    
    print("Schema altered successfully!")
    conn.close()
except Exception as e:
    print(f"Error altering schema: {e}")

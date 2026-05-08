const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const HEADERS = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
};

async function removeDuplicateAssertions() {
    console.log('Cleaning up duplicate assertions...');
    let allAssertions = [];
    let offset = 0;
    const limit = 2000;
    while (true) {
        const url = `${POSTGREST_URL}/assertions?select=assertion_id,subject_id,predicate,object_id,object_string,who,confidence,created&limit=${limit}&offset=${offset}&order=assertion_id.asc`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) throw new Error('Failed to fetch assertions for cleanup');
        const data = await res.json();
        if (data.length === 0) break;
        allAssertions = allAssertions.concat(data);
        if (allAssertions.length % 5000 === 0) {
            console.log(`Fetched ${allAssertions.length} assertions...`);
        }
        if (data.length < limit) break;
        offset += limit;
    }

    console.log(`Total assertions to check: ${allAssertions.length}`);

    const groups = {};
    allAssertions.forEach(a => {
        const objValue = a.object_id || a.object_string || 'null';
        const key = `${a.subject_id}|${a.predicate}|${objValue}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    });

    const idsToDelete = [];
    for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
            group.sort((a, b) => {
                if (a.who !== 'expanded' && b.who === 'expanded') return -1;
                if (a.who === 'expanded' && b.who !== 'expanded') return 1;
                if ((b.confidence || 0) !== (a.confidence || 0)) return (b.confidence || 0) - (a.confidence || 0);
                return (a.created || '').localeCompare(b.created || '');
            });
            for (let i = 1; i < group.length; i++) {
                if (group[i].assertion_id) {
                    idsToDelete.push(group[i].assertion_id);
                }
            }
        }
    }

    if (idsToDelete.length > 0) {
        console.log(`Found ${idsToDelete.length} duplicates. Deleting in batches...`);
        for (let i = 0; i < idsToDelete.length; i += 100) {
            const chunk = idsToDelete.slice(i, i + 100);
            try {
                const delRes = await fetch(`${POSTGREST_URL}/assertions?assertion_id=in.(${chunk.join(',')})`, {
                    method: 'DELETE',
                    headers: HEADERS
                });
                if (!delRes.ok) {
                    console.error(`Warning: Failed to delete batch starting at ${i}`);
                }
            } catch (e) {
                console.error(`Error deleting batch: ${e.message}`);
            }
        }
        console.log(`Successfully processed deletion of ${idsToDelete.length} assertions.`);
    } else {
        console.log('No duplicate assertions found.');
    }
}

removeDuplicateAssertions();

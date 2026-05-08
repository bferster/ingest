const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const HEADERS = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
};

async function checkDuplicates() {
    let allAssertions = [];
    let offset = 0;
    const limit = 5000;
    while (true) {
        const url = `${POSTGREST_URL}/assertions?select=subject_id,predicate,object_id,object_string&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: HEADERS });
        const data = await res.json();
        if (!data || data.length === 0) break;
        allAssertions = allAssertions.concat(data);
        console.log(`Fetched ${allAssertions.length} assertions...`);
        if (data.length < limit) break;
        offset += limit;
    }

    const groups = {};
    allAssertions.forEach(a => {
        const obj = a.object_id || a.object_string || 'null';
        const key = `${a.subject_id}|${a.predicate}|${obj}`;
        groups[key] = (groups[key] || 0) + 1;
    });

    const duplicates = Object.entries(groups).filter(([k, v]) => v > 1);
    console.log(`Found ${duplicates.length} groups with duplicates.`);
    duplicates.slice(0, 10).forEach(([k, v]) => {
        console.log(`Key ${k}: ${v} occurrences`);
    });
}

checkDuplicates();

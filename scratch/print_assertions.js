const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const HEADERS = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
};

async function printAssertions() {
    const res = await fetch(`${POSTGREST_URL}/assertions?select=subject_id,predicate,object_id,object_string,who`, { headers: HEADERS });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

printAssertions();

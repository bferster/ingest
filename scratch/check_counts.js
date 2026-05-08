const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const HEADERS = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
};

async function checkMentions() {
    const res = await fetch(`${POSTGREST_URL}/mentions?select=count`, { headers: { ...HEADERS, 'Prefer': 'count=exact' } });
    const count = res.headers.get('content-range');
    console.log(`Total Mentions: ${count}`);
    
    const res2 = await fetch(`${POSTGREST_URL}/assertions?select=count`, { headers: { ...HEADERS, 'Prefer': 'count=exact' } });
    const count2 = res2.headers.get('content-range');
    console.log(`Total Assertions: ${count2}`);
}

checkMentions();

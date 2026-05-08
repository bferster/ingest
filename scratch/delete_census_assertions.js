const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const HEADERS = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
};

async function deleteIncorrectAssertions() {
    const res = await fetch(`${POSTGREST_URL}/assertions?who=in.("1870Census","1880Census")`, { 
        method: 'DELETE', 
        headers: HEADERS 
    });
    console.log(`Deleted Census assertions. Status: ${res.status}`);
}

deleteIncorrectAssertions();

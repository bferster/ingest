const POSTGREST_URL = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZF91c2VyIiwiZXhwIjoxODA5MDMwNTQ0fQ.Odb66wuCHtVpGTT-ANI2Pgp5Cn9xEGndtSecu5boHzg';
const API_HEADERS = { 'Authorization': `Bearer ${JWT_TOKEN}`, 'Content-Type': 'application/json' };
const log = console.log;
const updateProgress = () => {};
const actionSelect = { disabled: false };
const progressSection = { classList: { remove: () => {} } };

const fs = require('fs');
const code = fs.readFileSync('contenderNarratives.js', 'utf8');
eval(code);

ContenderNarratives().then(() => console.log('Narratives Done'));

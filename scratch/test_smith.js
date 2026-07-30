const fs = require('fs');
const code = fs.readFileSync('c:/Bill/CC/js/AI/ingest/app.js', 'utf8');

const lines = code.split('\n');
const dmCode = lines.slice(1828, 2492).join('\n');

eval(dmCode);
console.log("doubleMetaphone('Smith') =>", doubleMetaphone('Smith'));

const fs = require('fs');

global.POSTGREST_URL = 'http://localhost:3000';
global.API_HEADERS = { 'Content-Type': 'application/json' };

global.log = (msg, isErr) => console.log(`[LOG] ${isErr ? 'ERROR: ' : ''}${msg}`);
global.updateProgress = (c, t, s, m) => console.log(`[PROGRESS] ${c}/${t} - ${m}`);

global.expandBtn = { disabled: false };
global.progressSection = { classList: { remove: () => {} } };

const _origFetch = global.fetch || require('node-fetch');
global.fetch = async (url, options) => {
    const res = await _origFetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        console.error(`Fetch failed: ${url} - Status: ${res.status} - ${text}`);
        return { ok: false, status: res.status, json: async () => ({}), text: async () => text };
    }
    return res;
};

const code = fs.readFileSync('assertionExpansion.js', 'utf8');
eval(code);

expandAssertions().then(() => {
    console.log("Debug run complete.");
}).catch(e => {
    console.error("Uncaught error:", e);
});

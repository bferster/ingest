const fs = require('fs');

// Extract the normalization functions from app.js to ensure we test the exact code
const appJsContent = fs.readFileSync('app.js', 'utf8');

function extractFunction(name, content) {
    const startIdx = content.indexOf(`function ${name}`);
    if (startIdx === -1) {
        // Try const/let variable declaration
        const varStartIdx = content.indexOf(`const ${name}`);
        if (varStartIdx === -1) {
            throw new Error(`Could not find definition for ${name}`);
        }
        // Extract array/object structure
        let braceCount = 0;
        let inString = false;
        let quoteChar = '';
        let endIdx = varStartIdx;
        for (let i = varStartIdx; i < content.length; i++) {
            const char = content[i];
            if ((char === '"' || char === "'" || char === '`') && content[i - 1] !== '\\') {
                if (!inString) {
                    inString = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inString = false;
                }
            }
            if (!inString) {
                if (char === '[' || char === '{') braceCount++;
                if (char === ']' || char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIdx = i + 1;
                        break;
                    }
                }
            }
        }
        return content.substring(varStartIdx, endIdx) + ';';
    }

    // Extract function block
    let braceCount = 0;
    let foundFirstBrace = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            foundFirstBrace = true;
        } else if (content[i] === '}') {
            braceCount--;
            if (foundFirstBrace && braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    return content.substring(startIdx, endIdx);
}

// Assemble the functions into executable JS
let testCode = '';
testCode += extractFunction('jaroWinkler', appJsContent) + '\n\n';
testCode += extractFunction('soundex', appJsContent) + '\n\n';
testCode += extractFunction('simpleNysiis', appJsContent) + '\n\n';
testCode += extractFunction('simpleRaceNorm', appJsContent) + '\n\n';
testCode += extractFunction('nicknames', appJsContent) + '\n\n';
testCode += extractFunction('normalizeFirstName', appJsContent) + '\n\n';
testCode += extractFunction('occupationCategories', appJsContent) + '\n\n';
testCode += extractFunction('normalizeOccupation', appJsContent) + '\n\n';

// Add the assertion library / test cases
testCode += `
function assert(expr, msg) {
    if (!expr) {
        console.error("FAIL:", msg);
        process.exit(1);
    } else {
        console.log("PASS:", msg);
    }
}

console.log("--- Starting Normalization Unit Tests ---");

// Test Nickname Algorithm
assert(normalizeFirstName("Robt J") === "ROBERT J", "normalizeFirstName('Robt J') -> ROBERT J");
assert(normalizeFirstName("Wm") === "WILLIAM", "normalizeFirstName('Wm') -> WILLIAM");

// Test Race Normalization
assert(simpleRaceNorm("W") === "W", "simpleRaceNorm('W') -> W");
assert(simpleRaceNorm("white") === "W", "simpleRaceNorm('white') -> W");
assert(simpleRaceNorm("Cauc") === "W", "simpleRaceNorm('Cauc') -> W");
assert(simpleRaceNorm("Caucasian") === "W", "simpleRaceNorm('Caucasian') -> W");
assert(simpleRaceNorm("Black") === "B", "simpleRaceNorm('Black') -> B");
assert(simpleRaceNorm("M") === "B", "simpleRaceNorm('M') -> B");
assert(simpleRaceNorm("") === "", "simpleRaceNorm('') -> ''");

// Test Soundex
assert(soundex("Smith") === "S530", "soundex('Smith') -> S530");
assert(soundex("Tymczak") === "T522", "soundex('Tymczak') -> T522");
assert(soundex("Pfister") === "P236", "soundex('Pfister') -> P236");

// Test NYSIIS
assert(simpleNysiis("MacDonald") === "MCDANALD", "simpleNysiis('MacDonald') -> MCDANALD");
assert(simpleNysiis("Schmidt") === "SNAD", "simpleNysiis('Schmidt') -> SNAD");
assert(simpleNysiis("Knuth") === "NAT", "simpleNysiis('Knuth') -> NAT");
assert(simpleNysiis("Smith") === "SNAT", "simpleNysiis('Smith') -> SNAT");

// Test Occupation (exact + keyword + fuzzy JW matching)
assert(normalizeOccupation("farmer") === "AGRICULTURE", "normalizeOccupation('farmer') -> AGRICULTURE");
assert(normalizeOccupation("house keeper") === "DOMESTIC", "normalizeOccupation('house keeper') -> DOMESTIC");
assert(normalizeOccupation("assistant blacksmith") === "METAL", "normalizeOccupation('assistant blacksmith') -> METAL");
assert(normalizeOccupation("apprentice tailor") === "TEXTILE", "normalizeOccupation('apprentice tailor') -> TEXTILE");
assert(normalizeOccupation("rail road") === "TRANSPORTATION", "normalizeOccupation('rail road') -> TRANSPORTATION");
assert(normalizeOccupation("school master") === "EDUCATION", "normalizeOccupation('school master') -> EDUCATION");

// Check Jaro-Winkler mapping for closest category
assert(normalizeOccupation("dairymn") === "AGRICULTURE", "normalizeOccupation('dairymn') (close to dairyman) -> AGRICULTURE");
assert(normalizeOccupation("blacksmth") === "METAL", "normalizeOccupation('blacksmth') (close to blacksmith) -> METAL");

console.log("All unit tests passed successfully!");
`;

fs.writeFileSync('scratch/run_test_norm.js', testCode);
console.log("Generated scratch/run_test_norm.js");

function jaroWinkler(s1, s2) {
	if (!s1 || !s2) return 0.0;
	s1 = s1.toLowerCase();
	s2 = s2.toLowerCase();
	
	if (s1 === s2) return 1.0;
	
	const len1 = s1.length;
	const len2 = s2.length;
	const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
	
	const matches1 = new Array(len1).fill(false);
	const matches2 = new Array(len2).fill(false);
	
	let m = 0;
	for (let i = 0; i < len1; i++) {
		const start = Math.max(0, i - matchWindow);
		const end = Math.min(len2 - 1, i + matchWindow);
		for (let j = start; j <= end; j++) {
			if (!matches2[j] && s1[i] === s2[j]) {
				matches1[i] = true;
				matches2[j] = true;
				m++;
				break;
			}
		}
	}
	
	if (m === 0) return 0.0;
	
	// Count transpositions
	let t = 0;
	let k = 0;
	for (let i = 0; i < len1; i++) {
		if (matches1[i]) {
			while (!matches2[k]) {
				k++;
			}
			if (s1[i] !== s2[k]) {
				t++;
			}
			k++;
		}
	}
	t = t / 2;
	
	const jaro = (m / len1 + m / len2 + (m - t) / m) / 3.0;
	
	// Winkler prefix scale
	let l = 0;
	const maxPrefix = Math.min(4, Math.min(len1, len2));
	for (let i = 0; i < maxPrefix; i++) {
		if (s1[i] === s2[i]) {
			l++;
		} else {
			break;
		}
	}
	
	const p = 0.1;
	return jaro + l * p * (1.0 - jaro);
}

function soundex(str) {
	if (!str) return '';
	let s = str.toUpperCase().replace(/[^A-Z]/g, '');
	if (!s) return '';

	const firstLetter = s[0];
	const mappings = {
		B: '1', F: '1', P: '1', V: '1',
		C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
		D: '3', T: '3',
		L: '4',
		M: '5', N: '5',
		R: '6'
	};

	let codes = [firstLetter];
	let prevCode = mappings[firstLetter] || '';

	for (let i = 1; i < s.length; i++) {
		let char = s[i];
		let code = mappings[char] || '';

		if (char === 'H' || char === 'W') {
			continue;
		}

		if (code) {
			if (code !== prevCode) {
				codes.push(code);
			}
			prevCode = code;
		} else {
			prevCode = '';
		}
	}

	return (codes.join('') + '000').substring(0, 4);
}

function simpleNysiis(str) {
	if (!str) return '';
	let s = str.toUpperCase().replace(/[^A-Z]/g, '');
	if (!s) return '';

	// At beginning of name
	if (s.startsWith('MAC')) {
		s = 'MC' + s.substring(3);
	} else if (s.startsWith('KN')) {
		s = 'N' + s.substring(2);
	} else if (s.startsWith('SCH')) {
		s = 'S' + s.substring(3);
	}

	// At end of name
	if (s.endsWith('EE')) {
		s = s.substring(0, s.length - 2) + 'Y';
	} else if (s.endsWith('IE')) {
		s = s.substring(0, s.length - 2) + 'Y';
	} else if (s.endsWith('DT') || s.endsWith('RT') || s.endsWith('RD') || s.endsWith('NT') || s.endsWith('ND')) {
		s = s.substring(0, s.length - 2) + 'D';
	}

	// Remove trailing S or A
	if (s.endsWith('S') || s.endsWith('A')) {
		s = s.substring(0, s.length - 1);
	}

	if (!s) return '';

	// Keep the first character of the current string
	const firstChar = s[0];
	let remainder = s.substring(1);
	let processed = '';

	const isVowel = (char) => {
		return char && 'AEIOU'.includes(char);
	};

	for (let i = 0; i < remainder.length; i++) {
		let char = remainder[i];

		// PH -> F
		if (char === 'P' && remainder[i + 1] === 'H') {
			processed += 'F';
			i++;
			continue;
		}

		if (char === 'H') {
			let prec = s[i];
			let foll = s[i + 2];
			if (isVowel(prec) && isVowel(foll)) {
				processed += 'H';
			}
			continue;
		}

		if (char === 'W') {
			let prec = s[i];
			if (!isVowel(prec)) {
				processed += 'W';
			}
			continue;
		}

		if ('AEIOU'.includes(char)) {
			processed += 'A';
		} else if (char === 'Q') {
			processed += 'G';
		} else if (char === 'Z') {
			processed += 'S';
		} else if (char === 'M') {
			processed += 'N';
		} else if (char === 'K') {
			processed += 'C';
		} else {
			processed += char;
		}
	}

	let result = firstChar + processed;

	// Collapse duplicates
	let collapsed = '';
	for (let i = 0; i < result.length; i++) {
		if (result[i] !== result[i - 1]) {
			collapsed += result[i];
		}
	}

	return collapsed;
}

function simpleRaceNorm(str) {
	if (!str) return '';
	const s = str.trim().toUpperCase();
	if (s === 'W' || s === 'CAUC' || s === 'CAUCASIAN' || s === 'WHITE') return 'W';
	return 'B';
}

const nicknames = {
	"WM": "WILLIAM", "BILL": "WILLIAM", "BILLY": "WILLIAM", "WILL": "WILLIAM", "WILLY": "WILLIAM", "WILLIE": "WILLIAM",
	"ROBT": "ROBERT", "ROB": "ROBERT", "BOB": "ROBERT", "BOBBY": "ROBERT", "ROBBIE": "ROBERT",
	"JAS": "JAMES", "JIM": "JAMES", "JIMMY": "JAMES", "JAMIE": "JAMES",
	"CHAS": "CHARLES", "CHARLIE": "CHARLES", "CHUCK": "CHARLES", "CARL": "CHARLES",
	"THOS": "THOMAS", "TOM": "THOMAS", "TOMMY": "THOMAS",
	"JNO": "JOHN", "JON": "JOHN", "JACK": "JOHN", "JACKIE": "JOHN", "JONNY": "JOHN", "JOHNNY": "JOHN",
	"DAN": "DANIEL", "DANNY": "DANIEL",
	"ED": "EDWARD", "EDDIE": "EDWARD", "NED": "EDWARD", "TED": "EDWARD", "TEDDY": "EDWARD",
	"GEO": "GEORGE",
	"JOS": "JOSEPH", "JOE": "JOSEPH", "JOEY": "JOSEPH",
	"SAM": "SAMUEL", "SAMMY": "SAMUEL",
	"ALEX": "ALEXANDER", "ALECK": "ALEXANDER", "ALEC": "ALEXANDER", "SANDY": "ALEXANDER",
	"PAT": "PATRICK", "PADDY": "PATRICK",
	"MATT": "MATTHEW", "MAT": "MATTHEW",
	"MIKE": "MICHAEL", "MICK": "MICHAEL", "MICKEY": "MICHAEL", "MICH": "MICHAEL",
	"DAVE": "DAVID", "DAVEY": "DAVID", "DAVY": "DAVID",
	"CHRIS": "CHRISTOPHER", "KIT": "CHRISTOPHER",
	"RICH": "RICHARD", "RICK": "RICHARD", "DICK": "RICHARD", "RICHD": "RICHARD", "DICKY": "RICHARD",
	"HARRY": "HENRY", "HAL": "HENRY", "HEN": "HENRY",
	"BEN": "BENJAMIN", "BENNY": "BENJAMIN", "BENJ": "BENJAMIN",
	"FRED": "FREDERICK", "FREDDY": "FREDERICK", "FREDK": "FREDERICK",
	"FRANK": "FRANCIS", "FRAN": "FRANCIS", "FRAS": "FRANCIS",
	"ANDY": "ANDREW",
	"TONY": "ANTHONY", "ANT": "ANTHONY",
	"ART": "ARTHUR", "ARTIE": "ARTHUR",
	"AL": "ALBERT", "ALB": "ALBERT",
	"ALF": "ALFRED", "ALFIE": "ALFRED",
	"WALT": "WALTER", "WALLY": "WALTER",
	"PETE": "PETER",
	"STEVE": "STEPHEN", "STEPH": "STEPHEN",
	"NICK": "NICHOLAS", "NICKY": "NICHOLAS",
	"NAT": "NATHANIEL", "NATE": "NATHANIEL", "NATHL": "NATHANIEL",
	"ABE": "ABRAHAM",
	"IKE": "ISAAC",
	"LI": "ELIJAH", "LIJE": "ELIJAH",
	"MANNY": "EMANUEL", "MANUEL": "EMANUEL",
	"HARV": "HARVEY",
	"LEW": "LEWIS",
	"MOSE": "MOSES",
	"SOL": "SOLOMON",
	"TOBY": "TOBIAS",
	"JERRY": "JEREMIAH", "JER": "JEREMIAH",
	"ZEKE": "EZEKIEL",
	"NEIL": "CORNELIUS", "CORN": "CORNELIUS",
	"BART": "BARTHOLOMEW",
	"ARCH": "ARCHIBALD", "ARCHIE": "ARCHIBALD",
	"GUS": "AUGUSTUS",
	"AMB": "AMBROSE",
	"ZACH": "ZACHARIAH", "ZACK": "ZACHARIAH",
	"LIZ": "ELIZABETH", "LIZZIE": "ELIZABETH", "LIZZY": "ELIZABETH", "BETH": "ELIZABETH", "BETTY": "ELIZABETH", "BETTE": "ELIZABETH", "BESS": "ELIZABETH", "BESSIE": "ELIZABETH", "ELIZA": "ELIZABETH", "ELIZ": "ELIZABETH", "LIBBY": "ELIZABETH",
	"MOLLY": "MARY", "POLLY": "MARY", "MAE": "MARY", "MAMIE": "MARY",
	"MAG": "MARGARET", "MAGGIE": "MARGARET", "MEG": "MARGARET", "PEGGY": "MARGARET", "MARG": "MARGARET", "MARGT": "MARGARET", "RITA": "MARGARET",
	"KATE": "CATHERINE", "KATIE": "CATHERINE", "KITTY": "CATHERINE", "KATH": "CATHERINE",
	"SARA": "SARAH", "SALLY": "SARAH", "SAL": "SARAH",
	"SUE": "SUSAN", "SUSIE": "SUSAN", "SUSY": "SUSAN", "SUSA": "SUSANNAH",
	"ANNIE": "ANN", "ANNA": "ANN", "NAN": "ANN", "NANNY": "ANN",
	"HANNA": "HANNAH",
	"MART": "MARTHA", "MATTIE": "MARTHA",
	"BECCA": "REBECCA", "BECKY": "REBECCA",
	"CARRIE": "CAROLINE", "CAROL": "CAROLINE",
	"NELL": "ELEANOR", "NELLIE": "ELEANOR", "NORA": "ELEANOR",
	"FANNY": "FRANCES",
	"HATTIE": "HARRIET",
	"LOU": "LOUISA", "LULA": "LOUISA",
	"TILLY": "MATILDA", "TILLIE": "MATILDA",
	"GINNY": "VIRGINIA",
	"VINA": "LAVINIA", "VINEY": "LAVINIA",
	"PRISSY": "PRISCILLA", "CILLA": "PRISCILLA",
	"DELIA": "DELILAH", "LILA": "DELILAH",
	"LUCY": "LUCINDA",
	"PHILLIS": "PHYLLIS",
	"MINNIE": "MINERVA"
};

function normalizeFirstName(raw) {
	if (!raw) return '';

	// Remove all non-alphabetic characters except spaces, and convert to uppercase
	let cleaned = raw.toUpperCase().replace(/[^A-Z\s]/g, '');

	// Split into parts (e.g. "ROBT J" -> ["ROBT", "J"])
	let parts = cleaned.split(/\s+/);

	// Map each part if it's in the nickname dictionary
	let mappedParts = parts.map(p => {
		if (nicknames[p]) {
			return nicknames[p];
		}
		return p;
	});

	// Return the uppercase string
	return mappedParts.join(' ').trim();
}

const occupationCategories = [
	{ label: "Agriculture", examples: ["farmer", "farmhand", "planter", "gardener", "cattle work", "dairyman", "shepherd", "hostler"] },
	{ label: "Food", examples: ["baker", "butcher", "miller", "flour work", "confectioner"] },
	{ label: "Textile", examples: ["tailor", "seamstress", "dressmaker", "weaver", "spinner"] },
	{ label: "Leather", examples: ["shoemaker", "shoe maker", "saddler", "tanner", "harness maker"] },
	{ label: "Metal", examples: ["blacksmith", "silversmith", "tinsmith", "gunsmith", "locksmith", "b smith", "blk-smith", "bsmith"] },
	{ label: "Woodwork", examples: ["carpenter", "cabinetmaker", "wheelwright", "chairmaker"] },
	{ label: "Construction", examples: ["mason", "brickmaker", "plasterer", "painter", "slater"] },
	{ label: "Transportation", examples: ["railroad worker", "railroad", "conductor", "engineer", "brakeman", "flagman", "boatman", "ferryman", "sailor", "waterman", "teamster", "drayman", "wagoner", "driver", "expressman", "rail road"] },
	{ label: "Domestic", examples: ["domestic", "servant", "cook", "butler", "chambermaid", "housekeeper", "laundress", "washerwoman", "nurse", "governess", "keep house", "keeping house", "at home", "house keeper", "house-keeping"] },
	{ label: "Commerce", examples: ["merchant", "grocer", "dealer", "trader", "storekeeper"] },
	{ label: "Office", examples: ["clerk", "bookkeeper", "accountant", "copyist"] },
	{ label: "Profession", examples: ["lawyer", "physician", "surveyor", "architect", "photographer", "doctor", "dentist", "banker", "nurse"] },
	{ label: "Education", examples: ["teacher", "college", "professor", "school", "university prof"] },
	{ label: "Religion", examples: ["minister", "preacher", "librarian"] },
	{ label: "Manufacturing", examples: ["machinist", "factory", "foundry", "manufacturer"] },
	{ label: "Extraction", examples: ["miner", "coal", "quarryman", "well digger"] },
	{ label: "Government", examples: ["police", "sheriff", "constable", "judge", "jailer", "postmaster", "tax collector", "inspector", "enumerator", "mayor", "post master", "post mistress"] },
	{ label: "Hospitality", examples: ["hotel", "saloonkeeper", "bartender", "waiter", "boarding house"] },
	{ label: "Craftsman", examples: ["jeweler", "watchmaker", "printer", "cooper"] },
	{ label: "Laborer", examples: ["laborer", "helper", "assistant", "errand"] }
];

function normalizeOccupation(raw) {
	if (!raw) return '';

	let s = raw.toLowerCase();

	// Remove punctuation
	s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

	// Remove specific words
	const removeWords = ["assist", "assistant", "intern", "app", "appren", "apprentice", "apprenticed"];
	removeWords.forEach(w => {
		const regex = new RegExp(`\\b${w}\\b`, 'gi');
		s = s.replace(regex, '');
	});

	s = s.replace(/\s{2,}/g, " ").trim();
	if (!s) return '';

	// Keyword matching overrides
	if (s.includes('school') || s.includes('university') || s.includes('prof')) return 'EDUCATION';
	if (s.includes('farm')) return 'AGRICULTURE';
	if (s.includes('maid') || s.includes('house')) return 'DOMESTIC';
	if (s.includes('r r')) return 'TRANSPORTATION';

	// Match categories
	for (const cat of occupationCategories) {
		for (const ex of cat.examples) {
			if (s.includes(ex)) {
				return cat.label.toUpperCase();
			}
		}
	}

	// Try to find the closest category using Jaro-Winkler
	let maxScore = -1;
	let closestLabel = '';
	for (const cat of occupationCategories) {
		// Compare with label
		let score = jaroWinkler(s, cat.label);
		if (score > maxScore) {
			maxScore = score;
			closestLabel = cat.label.toUpperCase();
		}
		// Compare with examples
		for (const ex of cat.examples) {
			score = jaroWinkler(s, ex);
			if (score > maxScore) {
				maxScore = score;
				closestLabel = cat.label.toUpperCase();
			}
		}
	}

	return closestLabel;
}


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

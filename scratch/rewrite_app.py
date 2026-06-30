import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update MentionIdGenerator
new_generator = """class MentionIdGenerator {
	constructor() {
		this.usedIds = {};
	}
	generate(prefix, line) {
		let cleanLine = String(line || '').trim();
		if (!cleanLine) {
			cleanLine = 'unknown';
		}
		const baseId = `${prefix}-${cleanLine}`;
		if (this.usedIds[baseId] === undefined) {
			this.usedIds[baseId] = 0;
			return baseId;
		} else {
			this.usedIds[baseId]++;
			return `${baseId}.${this.usedIds[baseId]}`;
		}
	}
}"""
content = re.sub(r'class MentionIdGenerator \{.*?\n\}', new_generator, content, flags=re.DOTALL)

# 2. Replace getFormatParams with getMentionPrefix
new_prefix_fn = """function getMentionPrefix(format, county, sourceYear, row) {
	if (format.includes('Census')) {
		const year = format.includes('1880') ? '1880' : '1870';
		return `${county}-CN-${year}`;
	} else if (format.includes('FindAGrave')) {
		return `${county}-FG`;
	} else if (format.includes('Church')) {
		return `${county}-CH`;
	} else if (format.includes('FreeBlackRegister')) {
		return `${county}-FBR`;
	} else if (format.includes('FreedmansList')) {
		return `${county}-FL`;
	} else if (format.includes('SlaveSchedule')) {
		return `${county}-SS-${sourceYear}`;
	} else if (format.includes('VitalRecord')) {
		const rType = (row && (row.type || row.Type || '')) ? String(row.type || row.Type).toLowerCase() : '';
		let pfx = 'VR';
		if (rType.includes('birth')) pfx = 'VRB';
		else if (rType.includes('death')) pfx = 'VRD';
		else if (rType.includes('marriage')) pfx = 'VRM';
		return `${county}-${pfx}`;
	}
	return `${county}-GEN`;
}"""
content = re.sub(r'function getFormatParams.*?return \{ type: type \|\| \'GEN\', year: year \|\| sourceYear \};\n\}', new_prefix_fn, content, flags=re.DOTALL)

# 3. Fix all usages of getFormatParams and idGenerator.generate
content = re.sub(
    r"const \{ type, year \} = getFormatParams\(format, selectedSource\.year\);\s*const line = getRowValue\(row, 'line'\) \|\| '';\s*const mId = idGenerator\.generate\(county, type, year, line\);",
    r"const prefix = getMentionPrefix(format, county, selectedSource.year, row);\n\tconst line = getRowValue(row, 'line') || '';\n\tconst mId = idGenerator.generate(prefix, line);",
    content
)

# 4. Remove `source:` and `is_enslaver:` from mention creations
content = re.sub(r'\s*source:\s*[^,]+,\n', '\n', content)
content = re.sub(r'\s*is_enslaver:\s*[^,]+,\n', '\n', content)

# 5. Fix DB fetching logic to use mention_id like instead of source
content = re.sub(
    r'const dbSource = await getDatabaseSource\(selectedSource\);',
    r"const dbSource = await getDatabaseSource(selectedSource);\n\tconst format = selectedSource.format || '';\n\tconst county = selectedSource.county || 'ALB';\n\tconst prefix = getMentionPrefix(format, county, selectedSource.year, null);",
    content
)

# Replace `source=eq.${encodeURIComponent(dbSource)}` with `mention_id=like.${prefix}-*`
content = re.sub(
    r'source=eq\.\$\{encodeURIComponent\(dbSource\)\}',
    r'mention_id=like.${prefix}-*',
    content
)

# Also fix the specific fetch in processSlaveScheduleAssertions
content = re.sub(
    r'source=eq\.\$\{encodeURIComponent\(dbSource\)\}&full_name=in\.',
    r'mention_id=like.${prefix}-*&full_name=in.',
    content
)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

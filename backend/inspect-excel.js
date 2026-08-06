import XLSX from 'xlsx';
import path from 'path';

const wb = XLSX.readFile('./uploads/1781505428167-5-Courses Fall 25-26 with student numbers.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log(`Total rows in student file: ${data.length}`);

// Group by code+program
const seen = {};
const duplicates = [];
data.forEach((row, idx) => {
  const code = row['Course Code'] || '';
  const name = row['Course Name'] || '';
  const program = row['Program Name'] || '';
  const count = row['Number of students in Course'] || 0;
  const key = `${code}|${program}`;
  
  if (seen[key]) {
    duplicates.push({ idx: idx+2, code, name, program, count, firstRow: seen[key].idx });
  } else {
    seen[key] = { idx: idx+2, code, name, program, count };
  }
});

console.log(`Unique (code+program) combos: ${Object.keys(seen).length}`);
console.log(`Duplicate rows (same code+program): ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log('\nDuplicate entries:');
  duplicates.forEach(d => {
    console.log(`  Row ${d.idx}: ${d.code} (${d.name}) [${d.program}] count=${d.count} — duplicate of row ${d.firstRow}`);
  });
}

// Also count unique codes regardless of program
const uniqueCodes = new Set(data.map(r => r['Course Code']));
console.log(`\nUnique course codes (ignoring program): ${uniqueCodes.size}`);
console.log(`Unique (code+program) pairs: ${Object.keys(seen).length}`);

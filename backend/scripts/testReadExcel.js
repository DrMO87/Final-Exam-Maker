import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test reading the generated Excel files
const sampleDataDir = path.join(__dirname, '..', '..', 'sample_data');

console.log('🔍 Testing Excel File Reading\n');
console.log('Sample data directory:', sampleDataDir);
console.log('='.repeat(80));

// Test PharmD Courses
const pharmdPath = path.join(sampleDataDir, 'pharmd_courses.xlsx');
console.log('\n📖 Reading: pharmd_courses.xlsx');
console.log('-'.repeat(80));

try {
  const workbook = XLSX.readFile(pharmdPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ File read successfully`);
  console.log(`📊 Total rows: ${data.length}`);
  console.log(`🔑 Column names:`, Object.keys(data[0] || {}));
  console.log(`\n📝 First 3 rows:`);
  data.slice(0, 3).forEach((row, i) => {
    console.log(`\nRow ${i + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });
} catch (error) {
  console.error('❌ Error reading file:', error.message);
}

// Test Clinical Courses
console.log('\n' + '='.repeat(80));
const clinicalPath = path.join(sampleDataDir, 'clinical_courses.xlsx');
console.log('\n📖 Reading: clinical_courses.xlsx');
console.log('-'.repeat(80));

try {
  const workbook = XLSX.readFile(clinicalPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ File read successfully`);
  console.log(`📊 Total rows: ${data.length}`);
  console.log(`🔑 Column names:`, Object.keys(data[0] || {}));
  console.log(`\n📝 First 3 rows:`);
  data.slice(0, 3).forEach((row, i) => {
    console.log(`\nRow ${i + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });
} catch (error) {
  console.error('❌ Error reading file:', error.message);
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ Test complete!\n');


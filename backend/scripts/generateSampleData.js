import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate sample Excel files for testing the scheduler
 */

// Sample PharmD Courses
const pharmdCourses = [
  { 'Semester': 'Level 1; Semester 1', 'Course Code': 'PHAR101', 'Course Title': 'Pharmaceutical Chemistry I', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 1; Semester 1', 'Course Code': 'PHAR102', 'Course Title': 'Pharmaceutics I', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 1; Semester 1', 'Course Code': 'PHAR103', 'Course Title': 'Anatomy & Physiology I', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 1; Semester 1', 'Course Code': 'PHAR104', 'Course Title': 'Pharmaceutical Calculations', 'Credit Hours': 2, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'Yes' },

  { 'Semester': 'Level 3; Semester 1', 'Course Code': 'PHAR301', 'Course Title': 'Pharmacology I', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 3; Semester 1', 'Course Code': 'PHAR302', 'Course Title': 'Medicinal Chemistry I', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 3; Semester 1', 'Course Code': 'PHAR303', 'Course Title': 'Pharmaceutics III', 'Credit Hours': 3, 'Has Oral Exam': 'Yes', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 3; Semester 1', 'Course Code': 'PHAR304', 'Course Title': 'Pathophysiology I', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },

  { 'Semester': 'Level 5; Semester 1', 'Course Code': 'PHAR501', 'Course Title': 'Clinical Pharmacy I', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 5; Semester 1', 'Course Code': 'PHAR502', 'Course Title': 'Therapeutics I', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 5; Semester 1', 'Course Code': 'PHAR503', 'Course Title': 'Pharmacokinetics', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 5; Semester 1', 'Course Code': 'PHAR504', 'Course Title': 'Pharmacy Practice', 'Credit Hours': 2, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
];

// Sample PharmD Clinical Courses
const clinicalCourses = [
  { 'Semester': 'Level 2; Semester 1', 'Course Code': 'CLIN201', 'Course Title': 'Clinical Skills I', 'Credit Hours': 3, 'Has Oral Exam': 'Yes', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 2; Semester 1', 'Course Code': 'CLIN202', 'Course Title': 'Patient Assessment', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 2; Semester 1', 'Course Code': 'CLIN203', 'Course Title': 'Pharmaceutical Care I', 'Credit Hours': 2, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },

  { 'Semester': 'Level 4; Semester 1', 'Course Code': 'CLIN401', 'Course Title': 'Clinical Skills II', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 4; Semester 1', 'Course Code': 'CLIN402', 'Course Title': 'Advanced Therapeutics', 'Credit Hours': 4, 'Has Oral Exam': 'Yes', 'Is Heavy': 'Yes', 'Must Be First': 'No' },
  { 'Semester': 'Level 4; Semester 1', 'Course Code': 'CLIN403', 'Course Title': 'Clinical Pharmacology', 'Credit Hours': 3, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
  { 'Semester': 'Level 4; Semester 1', 'Course Code': 'CLIN404', 'Course Title': 'Evidence-Based Medicine', 'Credit Hours': 2, 'Has Oral Exam': 'No', 'Is Heavy': 'No', 'Must Be First': 'No' },
];

// Sample PharmD Conflicts (realistic overlap counts)
const pharmdConflicts = [
  { 'Course A': 'PHAR101', 'Course B': 'PHAR102', 'Overlap Count': 85 },
  { 'Course A': 'PHAR101', 'Course B': 'PHAR103', 'Overlap Count': 78 },
  { 'Course A': 'PHAR101', 'Course B': 'PHAR104', 'Overlap Count': 90 },
  { 'Course A': 'PHAR102', 'Course B': 'PHAR103', 'Overlap Count': 82 },
  { 'Course A': 'PHAR102', 'Course B': 'PHAR104', 'Overlap Count': 88 },
  { 'Course A': 'PHAR103', 'Course B': 'PHAR104', 'Overlap Count': 80 },
  
  { 'Course A': 'PHAR301', 'Course B': 'PHAR302', 'Overlap Count': 65 },
  { 'Course A': 'PHAR301', 'Course B': 'PHAR303', 'Overlap Count': 70 },
  { 'Course A': 'PHAR301', 'Course B': 'PHAR304', 'Overlap Count': 68 },
  { 'Course A': 'PHAR302', 'Course B': 'PHAR303', 'Overlap Count': 62 },
  { 'Course A': 'PHAR302', 'Course B': 'PHAR304', 'Overlap Count': 60 },
  { 'Course A': 'PHAR303', 'Course B': 'PHAR304', 'Overlap Count': 58 },
  
  { 'Course A': 'PHAR501', 'Course B': 'PHAR502', 'Overlap Count': 45 },
  { 'Course A': 'PHAR501', 'Course B': 'PHAR503', 'Overlap Count': 48 },
  { 'Course A': 'PHAR501', 'Course B': 'PHAR504', 'Overlap Count': 42 },
  { 'Course A': 'PHAR502', 'Course B': 'PHAR503', 'Overlap Count': 50 },
  { 'Course A': 'PHAR502', 'Course B': 'PHAR504', 'Overlap Count': 40 },
  { 'Course A': 'PHAR503', 'Course B': 'PHAR504', 'Overlap Count': 38 },
  
  // Some cross-level conflicts (students retaking courses)
  { 'Course A': 'PHAR101', 'Course B': 'PHAR301', 'Overlap Count': 8 },
  { 'Course A': 'PHAR102', 'Course B': 'PHAR302', 'Overlap Count': 5 },
  { 'Course A': 'PHAR301', 'Course B': 'PHAR501', 'Overlap Count': 12 },
];

// Sample Clinical Conflicts
const clinicalConflicts = [
  { 'Course A': 'CLIN201', 'Course B': 'CLIN202', 'Overlap Count': 55 },
  { 'Course A': 'CLIN201', 'Course B': 'CLIN203', 'Overlap Count': 52 },
  { 'Course A': 'CLIN202', 'Course B': 'CLIN203', 'Overlap Count': 50 },
  
  { 'Course A': 'CLIN401', 'Course B': 'CLIN402', 'Overlap Count': 38 },
  { 'Course A': 'CLIN401', 'Course B': 'CLIN403', 'Overlap Count': 40 },
  { 'Course A': 'CLIN401', 'Course B': 'CLIN404', 'Overlap Count': 35 },
  { 'Course A': 'CLIN402', 'Course B': 'CLIN403', 'Overlap Count': 42 },
  { 'Course A': 'CLIN402', 'Course B': 'CLIN404', 'Overlap Count': 36 },
  { 'Course A': 'CLIN403', 'Course B': 'CLIN404', 'Overlap Count': 32 },
  
  // Cross-level conflicts
  { 'Course A': 'CLIN201', 'Course B': 'CLIN401', 'Overlap Count': 6 },
];

// Sample Student Numbers
const studentNumbers = [
  { 'Course Code': 'PHAR101', 'Student Count': 95 },
  { 'Course Code': 'PHAR102', 'Student Count': 92 },
  { 'Course Code': 'PHAR103', 'Student Count': 90 },
  { 'Course Code': 'PHAR104', 'Student Count': 95 },
  { 'Course Code': 'PHAR301', 'Student Count': 75 },
  { 'Course Code': 'PHAR302', 'Student Count': 72 },
  { 'Course Code': 'PHAR303', 'Student Count': 70 },
  { 'Course Code': 'PHAR304', 'Student Count': 73 },
  { 'Course Code': 'PHAR501', 'Student Count': 52 },
  { 'Course Code': 'PHAR502', 'Student Count': 50 },
  { 'Course Code': 'PHAR503', 'Student Count': 48 },
  { 'Course Code': 'PHAR504', 'Student Count': 45 },
  { 'Course Code': 'CLIN201', 'Student Count': 60 },
  { 'Course Code': 'CLIN202', 'Student Count': 58 },
  { 'Course Code': 'CLIN203', 'Student Count': 55 },
  { 'Course Code': 'CLIN401', 'Student Count': 42 },
  { 'Course Code': 'CLIN402', 'Student Count': 40 },
  { 'Course Code': 'CLIN403', 'Student Count': 38 },
  { 'Course Code': 'CLIN404', 'Student Count': 35 },
];

function generateExcelFile(data, filename) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  
  const outputPath = path.join(__dirname, '..', '..', 'sample_data', filename);
  XLSX.writeFile(wb, outputPath);
  console.log(`✅ Generated: ${filename}`);
}

// Create sample_data directory if it doesn't exist
import fs from 'fs';
const sampleDataDir = path.join(__dirname, '..', '..', 'sample_data');
if (!fs.existsSync(sampleDataDir)) {
  fs.mkdirSync(sampleDataDir, { recursive: true });
}

console.log('📊 Generating sample Excel files...\n');

generateExcelFile(pharmdCourses, 'pharmd_courses.xlsx');
generateExcelFile(clinicalCourses, 'clinical_courses.xlsx');
generateExcelFile(pharmdConflicts, 'pharmd_conflicts.xlsx');
generateExcelFile(clinicalConflicts, 'clinical_conflicts.xlsx');
generateExcelFile(studentNumbers, 'student_numbers.xlsx');

console.log('\n✅ All sample files generated in sample_data/ folder!');
console.log('\n📋 Files created:');
console.log('  - pharmd_courses.xlsx (12 courses)');
console.log('  - clinical_courses.xlsx (7 courses)');
console.log('  - pharmd_conflicts.xlsx (21 conflicts)');
console.log('  - clinical_conflicts.xlsx (10 conflicts)');
console.log('  - student_numbers.xlsx (19 courses)');
console.log('\n🎯 You can now upload these files to test the scheduler!');


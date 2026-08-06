import ExcelParser from './services/excelParser.js';
import path from 'path';

const sampleDir = path.resolve('..', 'sample_data');

console.log('=== INSPECTING PARSED CURRICULUM LEVELS ===');

const pharmdPath = path.join(sampleDir, 'pharmd_courses.csv');
console.log('\nParsing:', pharmdPath);
const pharmdCourses = ExcelParser.parseCourseFile(pharmdPath, 'PharmD');

const clinicalPath = path.join(sampleDir, 'clinical_pharmd_courses.csv');
console.log('\nParsing:', clinicalPath);
const clinicalCourses = ExcelParser.parseCourseFile(clinicalPath, 'PharmD Clinical');

console.log('\n--- Level Distribution in Curriculum Files ---');
const countByLevel = (courses, name) => {
  const dist = {};
  courses.forEach(c => {
    dist[c.level] = (dist[c.level] || 0) + 1;
  });
  console.log(`${name} levels:`, dist);
};

countByLevel(pharmdCourses, 'PharmD');
countByLevel(clinicalCourses, 'PharmD Clinical');

console.log('\n--- Checking Student Numbers Level Matching ---');
const studentPath = path.join(sampleDir, 'Student Numbers.csv');
const studentEntries = ExcelParser.parseStudentNumbers(studentPath);

const allCurriculum = [...pharmdCourses, ...clinicalCourses];
const normalizeStr = (s) => String(s).replace(/[\s\-]/g, '').toLowerCase();
const normalizeProgramName = (p) => {
  const lower = String(p).toLowerCase().trim();
  if (lower.includes('clinical')) return 'PharmD Clinical';
  if (lower.includes('pharmd') || lower.includes('pharm d')) return 'PharmD';
  return p;
};

let matchedWithLevel = 0;
let defaultedToLevel1 = 0;
const unmatchedList = [];

studentEntries.forEach((entry, idx) => {
  const { courseCode, courseName, program } = entry;
  const codeStr = normalizeStr(courseCode);
  const titleStr = normalizeStr(courseName);
  const mappedProgram = normalizeProgramName(program);

  // Match logic
  let match = allCurriculum.find(c => 
    normalizeStr(c.course_code) === codeStr && c.program === mappedProgram
  );

  if (!match) {
    match = allCurriculum.find(c => 
      normalizeStr(c.course_code) === codeStr
    );
  }

  if (!match) {
    match = allCurriculum.find(c => 
      normalizeStr(c.course_title) === titleStr && c.program === mappedProgram
    );
  }

  if (!match) {
    match = allCurriculum.find(c => 
      normalizeStr(c.course_title) === titleStr
    );
  }

  if (match) {
    matchedWithLevel++;
  } else {
    defaultedToLevel1++;
    unmatchedList.push({ idx: idx + 1, courseCode, courseName, program: mappedProgram });
  }
});

console.log(`\nTotal student entries: ${studentEntries.length}`);
console.log(`Matched with curriculum level: ${matchedWithLevel}`);
console.log(`Unmatched (defaulted to Level 1): ${defaultedToLevel1}`);

if (unmatchedList.length > 0) {
  console.log('\nUnmatched entries that defaulted to Level 1:');
  unmatchedList.forEach(u => {
    console.log(`  Row ${u.idx}: Code="${u.courseCode}" Title="${u.courseName}" [${u.program}]`);
  });
}

import ExcelParser from './services/excelParser.js';
import path from 'path';

const sampleDir = path.resolve('..', 'sample_data');
const pharmdCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'pharmd_courses.csv'), 'PharmD');
const clinicalCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'clinical_pharmd_courses.csv'), 'PharmD Clinical');
const allCurriculum = [...pharmdCourses, ...clinicalCourses];

const studentPath = path.join(sampleDir, 'Student Numbers.csv');
const studentEntries = ExcelParser.parseStudentNumbers(studentPath);

const normalizeStr = (s) => String(s).replace(/[\s\-]/g, '').toLowerCase();

// Advanced course matching including title substring and elective code parsing
const findCurriculumMatch = (entry) => {
  const { courseCode, courseName, program } = entry;
  const codeStr = normalizeStr(courseCode);
  const titleStr = normalizeStr(courseName);
  const progStr = program.toLowerCase().includes('clinical') ? 'PharmD Clinical' : 'PharmD';

  // 1. Exact code + program
  let m = allCurriculum.find(c => c.program === progStr && normalizeStr(c.course_code) === codeStr);
  if (m) return m;

  // 2. Exact code (any program)
  m = allCurriculum.find(c => normalizeStr(c.course_code) === codeStr);
  if (m) return m;

  // 3. Exact title + program
  m = allCurriculum.find(c => c.program === progStr && normalizeStr(c.course_title) === titleStr);
  if (m) return m;

  // 4. Title contains / contained in curriculum title
  m = allCurriculum.find(c => 
    c.program === progStr && (
      normalizeStr(c.course_title).includes(titleStr) || 
      titleStr.includes(normalizeStr(c.course_title))
    )
  );
  if (m) return m;

  // 5. Keyword title matching
  const keywords = ['cosmetic', 'negotiation', 'novel drug', 'respiratory', 'neurological', 'toxicology', 'biostatistics'];
  for (const kw of keywords) {
    if (titleStr.includes(normalizeStr(kw))) {
      m = allCurriculum.find(c => normalizeStr(c.course_title).includes(normalizeStr(kw)));
      if (m) return m;
    }
  }

  return null;
};

console.log('=== TESTING ADVANCED MATCHING ON ALL 86 COURSES ===');
let matchedCount = 0;
let unmatchedCount = 0;

studentEntries.forEach((entry, idx) => {
  const m = findCurriculumMatch(entry);
  if (m) {
    matchedCount++;
    console.log(`  ✅ Row ${idx + 1}: ${entry.courseCode} (${entry.courseName}) -> Level ${m.level} (${m.program}) [Oral: ${m.has_oral_exam ? 'Yes' : 'No'}]`);
  } else {
    unmatchedCount++;
    console.log(`  ❌ Row ${idx + 1}: UNMATCHED: ${entry.courseCode} (${entry.courseName})`);
  }
});

console.log(`\nMatched: ${matchedCount} / ${studentEntries.length}`);
console.log(`Unmatched: ${unmatchedCount}`);

import ExcelParser from './services/excelParser.js';
import path from 'path';

const sampleDir = path.resolve('..', 'sample_data');
const pharmdCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'pharmd_courses.csv'), 'PharmD');
const clinicalCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'clinical_pharmd_courses.csv'), 'PharmD Clinical');
const allCurriculum = [...pharmdCourses, ...clinicalCourses];

const studentPath = path.join(sampleDir, 'Student Numbers.csv');
const studentEntries = ExcelParser.parseStudentNumbers(studentPath);

const normalizeStr = (s) => String(s).replace(/[\s\-]/g, '').toLowerCase();

const inferLevelFromCode = (code, title) => {
  const codeStr = String(code).trim();
  const titleStr = String(title).toLowerCase();

  // Check elective keywords first
  if (titleStr.includes('novel drug') || titleStr.includes('phytotherapy') || titleStr.includes('neuropsychiatric') || codeStr.includes('008')) return 5;
  if (titleStr.includes('cosmetic') || titleStr.includes('drug design') || titleStr.includes('clinical nutrition') || codeStr.includes('004') || codeStr.includes('005') || codeStr.includes('006')) return 4;
  if (titleStr.includes('negotiation') || codeStr.includes('002')) return 2;

  // Extract first digit after prefix
  const match = codeStr.match(/[A-Z]+\-?(\d)/i);
  if (match) {
    const digit = parseInt(match[1]);
    if (digit >= 1 && digit <= 5) return digit;
  }

  return 1; // Fallback only if no digits found
};

const resolveCourseLevel = (entry) => {
  const { courseCode, courseName, program } = entry;
  const codeStr = normalizeStr(courseCode);
  const titleStr = normalizeStr(courseName);
  const progStr = program.toLowerCase().includes('clinical') ? 'PharmD Clinical' : 'PharmD';

  // 1. Exact code + program
  let m = allCurriculum.find(c => c.program === progStr && normalizeStr(c.course_code) === codeStr);
  if (m) return { ...m, levelSource: 'Curriculum Code+Program' };

  // 2. Exact title + program
  m = allCurriculum.find(c => c.program === progStr && normalizeStr(c.course_title) === titleStr);
  if (m) return { ...m, levelSource: 'Curriculum Title+Program' };

  // 3. Exact code (any program)
  m = allCurriculum.find(c => normalizeStr(c.course_code) === codeStr);
  if (m) return { ...m, levelSource: 'Curriculum Code' };

  // 4. Title substring
  m = allCurriculum.find(c => 
    c.program === progStr && (
      normalizeStr(c.course_title).includes(titleStr) || titleStr.includes(normalizeStr(c.course_title))
    )
  );
  if (m) return { ...m, levelSource: 'Curriculum Title Substring' };

  // 5. Code digit / keyword inference
  const inferredLevel = inferLevelFromCode(courseCode, courseName);
  return {
    level: inferredLevel,
    has_oral_exam: false,
    credit_hours: 3,
    is_heavy: false,
    levelSource: 'Code Digit Inference'
  };
};

console.log('=== VERIFYING FINAL LEVEL RESOLUTION FOR ALL 86 COURSES ===');
const levelDist = {};

studentEntries.forEach((entry, idx) => {
  const res = resolveCourseLevel(entry);
  levelDist[res.level] = (levelDist[res.level] || 0) + 1;
  console.log(`Row ${idx + 1}: ${entry.courseCode} (${entry.courseName}) [${entry.program}] -> Level ${res.level} (Source: ${res.levelSource})`);
});

console.log('\nFinal Level Distribution across all 86 courses:');
console.log(levelDist);

import ExcelParser from './services/excelParser.js';
import path from 'path';

const sampleDir = path.resolve('..', 'sample_data');
const pharmdCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'pharmd_courses.csv'), 'PharmD');
const clinicalCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'clinical_pharmd_courses.csv'), 'PharmD Clinical');

console.log('=== PHARMD COURSES SEARCH ===');
pharmdCourses.forEach((c, i) => {
  if (c.course_title.toLowerCase().includes('drug design') || c.course_code.includes('515') || c.course_code.includes('PC-')) {
    if (c.course_title.toLowerCase().includes('drug design')) {
      console.log(`PharmD Row ${i+1}: Code="${c.course_code}" Title="${c.course_title}" Level=${c.level}`);
    }
  }
});

console.log('\n=== CLINICAL COURSES SEARCH ===');
clinicalCourses.forEach((c, i) => {
  if (c.course_title.toLowerCase().includes('drug design')) {
    console.log(`Clinical Row ${i+1}: Code="${c.course_code}" Title="${c.course_title}" Level=${c.level}`);
  }
});

console.log('\n=== STUDENT NUMBERS ROW FOR PC-515 ===');
const studentEntries = ExcelParser.parseStudentNumbers(path.join(sampleDir, 'Student Numbers.csv'));
studentEntries.forEach((e, i) => {
  if (e.courseCode.includes('515') || e.courseName.toLowerCase().includes('drug design')) {
    console.log(`Student Row ${i+1}: Code="${e.courseCode}" Title="${e.courseName}" Program="${e.program}" Count=${e.studentCount}`);
  }
});

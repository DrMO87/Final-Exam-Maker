import ExcelParser from './services/excelParser.js';
import path from 'path';

const sampleDir = path.resolve('..', 'sample_data');
const pharmdCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'pharmd_courses.csv'), 'PharmD');
const clinicalCourses = ExcelParser.parseCourseFile(path.join(sampleDir, 'clinical_pharmd_courses.csv'), 'PharmD Clinical');

const targets = ['UE-002', 'PT-006', 'PT-008', 'PP-008', 'PT-005', 'PT-004', 'Cosmetic', 'Negotiation', 'Delivery', 'Respiratory'];

console.log('=== SEARCHING IN PHARMD COURSES ===');
pharmdCourses.forEach(c => {
  if (targets.some(t => c.course_code.includes(t) || c.course_title.includes(t))) {
    console.log(`PharmD: Code="${c.course_code}" Title="${c.course_title}" Level=${c.level}`);
  }
});

console.log('\n=== SEARCHING IN CLINICAL COURSES ===');
clinicalCourses.forEach(c => {
  if (targets.some(t => c.course_code.includes(t) || c.course_title.includes(t))) {
    console.log(`Clinical: Code="${c.course_code}" Title="${c.course_title}" Level=${c.level}`);
  }
});

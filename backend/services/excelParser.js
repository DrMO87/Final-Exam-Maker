import XLSX from 'xlsx';

class ExcelParser {
  static parseCourseFile(filePath, program) {
    console.log(`  📖 Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`  📋 Found ${data.length} rows in Excel file`);
    if (data.length > 0) {
      console.log(`  🔑 Column names:`, Object.keys(data[0]));
      console.log(`  📝 First row sample:`, data[0]);
    }

    const courses = [];

    const getRowValue = (row, possibleKeys) => {
      for (const targetKey of possibleKeys) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === targetKey.trim().toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
          return row[foundKey];
        }
      }
      return null;
    };

    data.forEach((row, index) => {
      let level = null;

      const levelVal = getRowValue(row, ['Level', 'level']);
      if (levelVal !== null && levelVal !== undefined) {
        const match = String(levelVal).match(/\d+/);
        if (match) level = parseInt(match[0]);
      }

      if (!level) {
        const semesterText = getRowValue(row, ['Semester', 'semester']) || '';
        const levelMatch = String(semesterText).match(/Level\s*(\d+)/i);
        level = levelMatch ? parseInt(levelMatch[1]) : null;
      }

      if (!level) {
        console.log(`  ⚠️  Row ${index + 1}: No level found, defaulting to Level 1.`);
        level = 1; 
      }

      const courseCode = getRowValue(row, ['Course Code', 'course_code', 'CourseCode', 'Code', 'Subject', 'Course']) || '';
      const courseTitle = getRowValue(row, ['Course Title', 'course_title', 'CourseTitle', 'Title', 'Course Name', 'Name']) || courseCode;

      if (!courseCode) {
        console.log(`  ⚠️  Row ${index + 1} skipped: Missing course code`);
        return;
      }

      let creditHours = 3;
      const creditVal = getRowValue(row, ['Credit Total', 'credit_total', 'Credit Hours', 'credit_hours', 'Credits']);
      if (creditVal) {
        creditHours = parseInt(creditVal) || 3;
      }

      const hasOralExam = this.parseBoolean(getRowValue(row, ['Has Oral Exam', 'has_oral_exam', 'Oral']));
      const hasPracticalExam = this.parseBoolean(getRowValue(row, ['Has Practical Exam', 'has_practical_exam', 'Practical']));

      // Determine if course is heavy (has practical exam or credit hours >= 4)
      const isHeavy = hasPracticalExam || creditHours >= 4;

      const course = {
        program: program,
        level: level,
        course_code: courseCode,
        course_title: courseTitle,
        has_oral_exam: hasOralExam,
        student_count: parseInt(row['Student Count'] || row['student_count'] || 0),
        credit_hours: creditHours,
        is_heavy: isHeavy,
        must_be_first: false // Default to false, can be set later if needed
      };

      courses.push(course);
      console.log(`  ✅ Row ${index + 1}: ${courseCode} - ${courseTitle} (Level ${level}, Credits: ${creditHours}, Heavy: ${isHeavy})`);
    });

    console.log(`  ✅ Parsed ${courses.length} courses from ${program}`);
    return courses;
  }

  static parseConflictMatrix(filePath, courseLookup) {
    console.log(`  📖 Reading conflict matrix: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`  📋 Found ${data.length} rows in conflict matrix`);

    const conflicts = [];

    if (!data || data.length < 2) {
      console.log(`  ⚠️  Conflict matrix is empty or has insufficient data`);
      return conflicts;
    }

    const headers = data[0] || [];

    const normalizeKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Helper to resolve course ID from code or title
    const getCourseId = (courseIdentifier) => {
      if (!courseIdentifier) return null;
      const str = courseIdentifier.toString().trim();
      const normStr = normalizeKey(str);
      if (!normStr) return null;

      let id = courseLookup[str] || courseLookup[normStr];
      if (!id) {
        const key = Object.keys(courseLookup).find(k => {
          const normK = normalizeKey(k);
          return normK === normStr || (normK.length >= 4 && normStr.length >= 4 && (normK.includes(normStr) || normStr.includes(normK)));
        });
        if (key) id = courseLookup[key];
      }
      return id;
    };

    // Check if this is a 3-column list format (e.g., Course A | Course B | Overlap Count)
    const isListFormat = headers.length >= 3 &&
      (headers[0].toString().toLowerCase().includes('course') || headers[0].toString().toLowerCase().includes('subject')) &&
      (headers[1].toString().toLowerCase().includes('course') || headers[1].toString().toLowerCase().includes('subject'));

    if (isListFormat) {
      console.log(`  📋 Detected List-based Conflict Format (Course A | Course B | Overlap)`);

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 3) continue;

        const courseAId = getCourseId(row[0]);
        const courseBId = getCourseId(row[1]);
        const overlapCount = parseInt(row[2]) || 0;

        if (courseAId && courseBId && courseAId !== courseBId && overlapCount > 0) {
          const minId = Math.min(courseAId, courseBId);
          const maxId = Math.max(courseAId, courseBId);

          // Prevent duplicate conflict entries
          if (!conflicts.some(c => c.course_a_id === minId && c.course_b_id === maxId)) {
            conflicts.push({
              course_a_id: minId,
              course_b_id: maxId,
              overlap_count: overlapCount
            });
            console.log(`  ✅ Conflict (List): "${row[0]}" <-> "${row[1]}" (${overlapCount} students)`);
          }
        }
      }

      console.log(`  ✅ Parsed ${conflicts.length} conflicts from list format`);
      return conflicts;
    }

    console.log(`  🔑 Found ${headers.length} columns in conflict matrix grid`);
    console.log(`  📝 First column header: "${headers[0]}" (should be "subject" or course identifier)`);

    // Process each row (Matrix format)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      const courseA = row[0];

      if (!courseA || courseA.toString().includes('Level (')) continue;

      let courseAId = getCourseId(courseA);

      if (!courseAId) {
        console.log(`  ⚠️  Row ${i}: Course "${courseA}" not found in course lookup`);
        continue;
      }

      for (let j = 1; j < row.length && j < headers.length; j++) {
        const courseB = headers[j];
        if (!courseB || courseB.toString().includes('Level (')) continue;

        let courseBId = getCourseId(courseB);
        if (!courseBId) continue;

        const overlapCount = parseInt(row[j]) || 0;

        if (overlapCount > 0 && courseAId < courseBId) {
          conflicts.push({
            course_a_id: courseAId,
            course_b_id: courseBId,
            overlap_count: overlapCount
          });
          console.log(`  ✅ Conflict (Matrix): "${courseA}" <-> "${courseB}" (${overlapCount} students)`);
        }
      }
    }

    console.log(`  ✅ Parsed ${conflicts.length} conflicts from matrix`);
    return conflicts;
  }

  static parseStudentNumbers(filePath) {
    console.log(`  📖 Reading student numbers file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`  📋 Found ${data.length} rows in student numbers file`);
    if (data.length > 0) {
      console.log(`  🔑 Column names:`, Object.keys(data[0]));
    }

    const entries = [];

    const getRowValue = (row, possibleKeys) => {
      for (const targetKey of possibleKeys) {
        const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === targetKey.trim().toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
          return row[foundKey];
        }
      }
      return null;
    };

    data.forEach((row, index) => {
      const courseCode = getRowValue(row, ['Subject Code', 'Course Code', 'course_code', 'Code', 'SubjectCode', 'Subject']) || '';
      const courseName = getRowValue(row, ['Subject', 'Course Name', 'course_name', 'Course Title', 'Title', 'CourseName']) || courseCode;
      const studentCount = parseInt(
        getRowValue(row, ['Number in Course', 'Number of students in Course', 'Student Count', 'student_count', 'Count', 'Total', 'Students']) || 0
      );
      const program = getRowValue(row, ['Program', 'Program Name', 'program_name', 'ProgramName']) || '';

      if (courseCode) {
        entries.push({ 
          courseCode: String(courseCode).trim(), 
          courseName: String(courseName).trim(), 
          studentCount: isNaN(studentCount) ? 0 : studentCount, 
          program: String(program).trim() 
        });
        console.log(`  ✅ Row ${index + 1}: ${courseCode} (${courseName}) [${program}]: ${studentCount} students`);
      } else {
        console.log(`  ⚠️  Row ${index + 1} skipped: No course code found`);
      }
    });

    console.log(`  ✅ Parsed ${entries.length} student number entries`);
    return entries;
  }

  static parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) return defaultValue;
    
    const str = value.toString().toLowerCase().trim();
    return str === 'yes' || str === 'true' || str === '1' || str === 'y';
  }
}

export default ExcelParser;


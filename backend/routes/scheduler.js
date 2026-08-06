import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database.js';
import ExcelParser from '../services/excelParser.js';
import SchedulerEngine from '../services/schedulerEngine.js';
import AdvancedScheduler from '../services/advancedScheduler.js';

import os from 'os';

const router = express.Router();

const inferLevelFromCode = (code, title) => {
  const codeStr = String(code).trim().toUpperCase();
  const titleStr = String(title || '').toLowerCase();

  // Rule 1: Non-zero first digit (1-5) from left in course code directly determines level (e.g. PC-515 -> Level 5)
  const digitMatch = codeStr.match(/(\d)/);
  const firstDigit = digitMatch ? digitMatch[1] : null;

  if (firstDigit && firstDigit >= '1' && firstDigit <= '5') {
    return parseInt(firstDigit);
  }

  // Rule 2: Elective courses starting with '0' (e.g. 002, 004, 008) -> Review from program curriculum / keywords
  if (titleStr.includes('novel drug') || titleStr.includes('phytotherapy') || titleStr.includes('neuropsychiatric') || titleStr.includes('respiratory') || codeStr.includes('008')) return 5;
  if (titleStr.includes('cosmetic') || titleStr.includes('drug design') || titleStr.includes('clinical nutrition') || codeStr.includes('004') || codeStr.includes('005') || codeStr.includes('006')) return 4;
  if (titleStr.includes('negotiation') || codeStr.includes('002')) return 2;

  return 1;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(os.tmpdir(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
      return cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed'));
    }
    cb(null, true);
  }
});

// Create a new scheduling session
router.post('/session', async (req, res) => {
  try {
    const { session_name, semester, start_date, end_date } = req.body;

    const result = await pool.query(
      `INSERT INTO scheduling_sessions (session_name, semester, start_date, end_date)
       VALUES (?, ?, ?, ?) RETURNING *`,
      [session_name, semester, start_date, end_date]
    );

    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load and process sample data files automatically
router.post('/load-sample', async (req, res) => {
  const client = await pool.connect();
  try {
    const { session_id } = req.body;
    if (!session_id || session_id === 'null' || session_id === 'undefined') {
      return res.status(400).json({ success: false, error: 'No active session found.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM conflicts WHERE session_id = ?', [session_id]);
    await client.query('DELETE FROM courses WHERE session_id = ?', [session_id]);

    const candidateDirs = [
      path.resolve(process.cwd(), 'sample_data'),
      path.resolve(process.cwd(), '..', 'sample_data'),
      path.resolve(process.cwd(), 'backend', 'sample_data'),
      path.resolve(path.dirname(path.dirname(process.argv[1] || '')), 'sample_data')
    ];

    const sampleDir = candidateDirs.find(d => fs.existsSync(d));
    if (!sampleDir) {
      throw new Error(`Sample data directory not found. Checked: ${candidateDirs.join(', ')}`);
    }

    const getSamplePath = (keyword) => {
      const files = fs.readdirSync(sampleDir);
      const normKey = keyword.toLowerCase().replace(/[\s_\-]/g, '');
      const matched = files.find(f => f.toLowerCase().replace(/[\s_\-]/g, '').includes(normKey));
      if (matched) return path.join(sampleDir, matched);
      throw new Error(`Sample file matching "${keyword}" not found in ${sampleDir}`);
    };

    const pharmdCourses = ExcelParser.parseCourseFile(getSamplePath('pharmd_courses'), 'PharmD');
    const clinicalCourses = ExcelParser.parseCourseFile(getSamplePath('clinical'), 'PharmD Clinical');
    let allCourses = [...pharmdCourses, ...clinicalCourses];

    const studentEntries = ExcelParser.parseStudentNumbers(getSamplePath('student'));
    if (studentEntries.length > 0) {
      const scheduledCourses = [];
      const normalizeStr = (s) => String(s).replace(/[\s\-]/g, '').toLowerCase();
      const normalizeProgramName = (p) => {
        const lower = String(p).toLowerCase().trim();
        if (lower.includes('clinical')) return 'PharmD Clinical';
        if (lower.includes('pharmd') || lower.includes('pharm d')) return 'PharmD';
        return p;
      };

      const inferLevelFromCode = (code, title) => {
        const codeStr = String(code).trim().toUpperCase();
        const titleStr = String(title).toLowerCase();

        // Rule 1: Non-zero first digit (1-5) from left in course code directly determines level (e.g. PC-515 -> Level 5)
        const digitMatch = codeStr.match(/(\d)/);
        const firstDigit = digitMatch ? digitMatch[1] : null;

        if (firstDigit && firstDigit >= '1' && firstDigit <= '5') {
          return parseInt(firstDigit);
        }

        // Rule 2: Elective courses starting with '0' (e.g. 002, 004, 008) -> Review from program curriculum / keywords
        if (titleStr.includes('novel drug') || titleStr.includes('phytotherapy') || titleStr.includes('neuropsychiatric') || titleStr.includes('respiratory') || codeStr.includes('008')) return 5;
        if (titleStr.includes('cosmetic') || titleStr.includes('drug design') || titleStr.includes('clinical nutrition') || codeStr.includes('004') || codeStr.includes('005') || codeStr.includes('006')) return 4;
        if (titleStr.includes('negotiation') || codeStr.includes('002')) return 2;

        return 1;
      };

      for (const entry of studentEntries) {
        const { courseCode, courseName, studentCount, program } = entry;
        const codeStr = normalizeStr(courseCode);
        const titleStr = normalizeStr(courseName);
        const mappedProgram = normalizeProgramName(program);

        const primaryCurriculum = mappedProgram === 'PharmD Clinical' ? clinicalCourses : pharmdCourses;
        const secondaryCurriculum = mappedProgram === 'PharmD Clinical' ? pharmdCourses : clinicalCourses;

        let curriculumCourse = primaryCurriculum.find(c => normalizeStr(c.course_code) === codeStr);

        if (!curriculumCourse) {
          curriculumCourse = primaryCurriculum.find(c => normalizeStr(c.course_title) === titleStr);
        }

        if (!curriculumCourse) {
          curriculumCourse = primaryCurriculum.find(c => 
            !c.course_code.toLowerCase().includes('00x') &&
            (normalizeStr(c.course_title).includes(titleStr) || titleStr.includes(normalizeStr(c.course_title)))
          );
        }

        if (!curriculumCourse) {
          curriculumCourse = secondaryCurriculum.find(c => normalizeStr(c.course_code) === codeStr);
        }

        if (!curriculumCourse && !codeStr.includes('00x')) {
          curriculumCourse = secondaryCurriculum.find(c => 
            !c.course_code.toLowerCase().includes('00x') &&
            (normalizeStr(c.course_title) === titleStr || normalizeStr(c.course_title).includes(titleStr) || titleStr.includes(normalizeStr(c.course_title)))
          );
        }

        if (curriculumCourse) {
          scheduledCourses.push({
            ...curriculumCourse,
            program: curriculumCourse.program,
            student_count: studentCount
          });
        } else {
          scheduledCourses.push({
            program: mappedProgram || 'Unknown',
            level: inferLevelFromCode(courseCode, courseName),
            course_code: courseCode,
            course_title: courseName || courseCode,
            has_oral_exam: false,
            student_count: studentCount,
            credit_hours: 3,
            is_heavy: false,
            must_be_first: false
          });
        }
      }
      allCourses = scheduledCourses;
    }

    const pharmdCourseLookup = {};
    const clinicalCourseLookup = {};
    const globalCourseLookup = {};
    let insertedCount = 0;

    for (const course of allCourses) {
      const result = await client.query(
        `INSERT INTO courses (session_id, program, level, course_code, course_title,
         has_oral_exam, student_count, credit_hours, is_heavy, must_be_first)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [session_id, course.program, course.level, course.course_code, course.course_title,
         course.has_oral_exam ? 1 : 0, course.student_count, course.credit_hours,
         course.is_heavy ? 1 : 0, course.must_be_first ? 1 : 0]
      );
      const courseId = result.rows[0].id;
      const normCode = String(course.course_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = String(course.course_title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const lookup = course.program === 'PharmD Clinical' ? clinicalCourseLookup : pharmdCourseLookup;
      lookup[course.course_code] = courseId;
      lookup[course.course_title] = courseId;
      lookup[normCode] = courseId;
      lookup[normTitle] = courseId;

      globalCourseLookup[course.course_code] = courseId;
      globalCourseLookup[course.course_title] = courseId;
      globalCourseLookup[normCode] = courseId;
      globalCourseLookup[normTitle] = courseId;

      insertedCount++;
    }

    const pharmdConflicts = ExcelParser.parseConflictMatrix(getSamplePath('pharmd_conflicts'), pharmdCourseLookup);
    const clinicalConflicts = ExcelParser.parseConflictMatrix(getSamplePath('clinical_conflicts'), clinicalCourseLookup);
    const allConflicts = [...pharmdConflicts, ...clinicalConflicts];

    for (const conflict of allConflicts) {
      await client.query(
        `INSERT INTO conflicts (session_id, course_a_id, course_b_id, overlap_count)
         VALUES (?, ?, ?, ?) ON CONFLICT (session_id, course_a_id, course_b_id) DO NOTHING`,
        [session_id, conflict.course_a_id, conflict.course_b_id, conflict.overlap_count]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Sample data files loaded successfully',
      stats: { courses: insertedCount, conflicts: allConflicts.length }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error loading sample data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
router.post('/upload', upload.fields([
  { name: 'pharmd_courses', maxCount: 1 },
  { name: 'clinical_courses', maxCount: 1 },
  { name: 'pharmd_conflicts', maxCount: 1 },
  { name: 'clinical_conflicts', maxCount: 1 },
  { name: 'student_numbers', maxCount: 1 }
]), async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { session_id } = req.body;
    
    if (!session_id || session_id === 'null' || session_id === 'undefined') {
      return res.status(400).json({ success: false, error: 'No active session found. Please click "Back" and create a session in Step 1 first.' });
    }

    const sessionCheck = await client.query('SELECT id FROM scheduling_sessions WHERE id = ?', [session_id]);
    if (!sessionCheck.rows || sessionCheck.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Session not found. Please click "Back" and create a session in Step 1 first.' });
    }

    await client.query('BEGIN');
    
    // Clear out any previously uploaded courses/conflicts for this session to prevent duplicates on re-upload
    await client.query('DELETE FROM conflicts WHERE session_id = ?', [session_id]);
    await client.query('DELETE FROM courses WHERE session_id = ?', [session_id]);

    // Parse course files
    console.log('📂 Parsing course files...');
    const pharmdCourses = req.files['pharmd_courses']
      ? ExcelParser.parseCourseFile(req.files['pharmd_courses'][0].path, 'PharmD')
      : [];
    console.log(`  ✅ PharmD courses parsed: ${pharmdCourses.length}`);

    const clinicalCourses = req.files['clinical_courses']
      ? ExcelParser.parseCourseFile(req.files['clinical_courses'][0].path, 'PharmD Clinical')
      : [];
    console.log(`  ✅ Clinical courses parsed: ${clinicalCourses.length}`);

    let allCourses = [...pharmdCourses, ...clinicalCourses];
    console.log(`📊 Total courses in curriculum files: ${allCourses.length}`);

    // Parse student numbers if provided and use it as the definitive list
    if (req.files['student_numbers']) {
      const studentEntries = ExcelParser.parseStudentNumbers(req.files['student_numbers'][0].path);
      const scheduledCourses = [];
      
      const normalizeStr = (s) => String(s).replace(/[\s\-]/g, '').toLowerCase();

      // Map program names from student file to program names used in curriculum parsing
      const normalizeProgramName = (p) => {
        const lower = p.toLowerCase().trim();
        if (lower.includes('clinical')) return 'PharmD Clinical';
        if (lower.includes('pharmd') || lower.includes('pharm d')) return 'PharmD';
        return p; // fallback to original
      };

      // Levenshtein distance helper function
      const getEditDistance = (a, b) => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
        for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
              );
            }
          }
        }
        return matrix[b.length][a.length];
      };

      for (const entry of studentEntries) {
        const { courseCode, courseName, studentCount, program } = entry;
        const codeStr = normalizeStr(courseCode);
        const mappedProgram = normalizeProgramName(program);
        
        // 1. Try exact match on code + same program
        let curriculumCourse = allCourses.find(c => 
          normalizeStr(c.course_code) === codeStr && c.program === mappedProgram
        );

        // 2. Try exact match on title + same program
        if (!curriculumCourse) {
          const nameStr = normalizeStr(courseName);
          curriculumCourse = allCourses.find(c => 
            normalizeStr(c.course_title) === nameStr && c.program === mappedProgram
          );
        }

        // 3. Try exact match on code (any program)
        if (!curriculumCourse) {
          curriculumCourse = allCourses.find(c => 
            normalizeStr(c.course_code) === codeStr
          );
        }

        // 4. Try exact match on title (any program)
        if (!curriculumCourse) {
          const nameStr = normalizeStr(courseName);
          curriculumCourse = allCourses.find(c => 
            normalizeStr(c.course_title) === nameStr
          );
        }

        // 5. Try Fuzzy Match (Typos or Substrings) - EXCLUDE generic placeholders like 00X
        if (!curriculumCourse && !codeStr.includes('00x')) {
          let bestMatch = null;
          let lowestDistance = Infinity;

          for (const c of allCourses) {
            const cCode = normalizeStr(c.course_code);
            const cTitle = normalizeStr(c.course_title);

            if (cCode.includes('00x')) continue; // Skip generic placeholders like UE-00X, FE-00X

            if (cCode.includes(codeStr) || codeStr.includes(cCode) || 
                cTitle.includes(codeStr) || codeStr.includes(cTitle)) {
              bestMatch = c;
              lowestDistance = 0;
              break;
            }

            const distCode = getEditDistance(codeStr, cCode);
            const distTitle = getEditDistance(codeStr, cTitle);
            const minD = Math.min(distCode, distTitle);

            if (minD < lowestDistance && minD <= 2) {
              lowestDistance = minD;
              bestMatch = c;
            }
          }

          if (bestMatch) {
            console.log(`  🔍 Fuzzy matched "${courseCode}" to "${bestMatch.course_code}" (Distance: ${lowestDistance})`);
            curriculumCourse = bestMatch;
          }
        }

        if (curriculumCourse) {
          scheduledCourses.push({
            ...curriculumCourse,
            program: curriculumCourse.program,
            student_count: studentCount
          });
        } else {
          // Instead of throwing, create a new course entry from student file data
          console.log(`  ⚠️  Course "${courseCode}" (${courseName}) not found in curriculum files. Creating from student data.`);
          scheduledCourses.push({
            program: mappedProgram || 'Unknown',
            level: inferLevelFromCode(courseCode, courseName),
            course_code: courseCode,
            course_title: courseName || courseCode,
            has_oral_exam: false,
            student_count: studentCount,
            credit_hours: 3,
            is_heavy: false,
            must_be_first: false
          });
        }
      }
      
      allCourses = scheduledCourses;
      console.log(`📊 Final courses to schedule (based on Student Numbers): ${allCourses.length}`);
    } else {
      console.log(`📊 No Student Numbers file provided, scheduling all curriculum courses: ${allCourses.length}`);
    }

    // Insert courses into database
    // Insert courses into database
    const pharmdCourseLookup = {};
    const clinicalCourseLookup = {};
    const globalCourseLookup = {};

    console.log('💾 Inserting courses into database...');
    let insertedCount = 0;

    for (const course of allCourses) {
      console.log(`  📝 Inserting: [${course.program}] ${course.course_code} - ${course.course_title} (Level ${course.level})`);

      try {
        const result = await client.query(
          `INSERT INTO courses (session_id, program, level, course_code, course_title,
           has_oral_exam, student_count, credit_hours, is_heavy, must_be_first)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
          [session_id, course.program, course.level, course.course_code, course.course_title,
           course.has_oral_exam ? 1 : 0, course.student_count, course.credit_hours,
           course.is_heavy ? 1 : 0, course.must_be_first ? 1 : 0]
        );

        const courseId = result.rows[0].id;
        globalCourseLookup[course.course_code] = courseId;
        globalCourseLookup[course.course_title] = courseId;

        if (course.program === 'PharmD Clinical') {
          clinicalCourseLookup[course.course_code] = courseId;
          clinicalCourseLookup[course.course_title] = courseId;
        } else {
          pharmdCourseLookup[course.course_code] = courseId;
          pharmdCourseLookup[course.course_title] = courseId;
        }

        insertedCount++;
        console.log(`    ✅ Inserted with ID: ${courseId}`);
      } catch (insertError) {
        console.error(`    ❌ Error inserting course:`, insertError.message);
        throw insertError;
      }
    }

    console.log(`✅ Successfully inserted ${insertedCount} courses into database`);

    // Parse and insert conflicts
    let allConflicts = [];

    if (req.files['pharmd_conflicts']) {
      const pharmdConflicts = ExcelParser.parseConflictMatrix(
        req.files['pharmd_conflicts'][0].path, 
        Object.keys(pharmdCourseLookup).length > 0 ? pharmdCourseLookup : globalCourseLookup
      );
      allConflicts = [...allConflicts, ...pharmdConflicts];
    }

    if (req.files['clinical_conflicts']) {
      const clinicalConflicts = ExcelParser.parseConflictMatrix(
        req.files['clinical_conflicts'][0].path,
        Object.keys(clinicalCourseLookup).length > 0 ? clinicalCourseLookup : globalCourseLookup
      );
      allConflicts = [...allConflicts, ...clinicalConflicts];
    }

    for (const conflict of allConflicts) {
      await client.query(
        `INSERT INTO conflicts (session_id, course_a_id, course_b_id, overlap_count)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (session_id, course_a_id, course_b_id) DO NOTHING`,
        [session_id, conflict.course_a_id, conflict.course_b_id, conflict.overlap_count]
      );
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Files processed successfully',
      stats: {
        courses: allCourses.length,
        conflicts: allConflicts.length
      }
    });

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {}
    console.error('Error processing files:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (unlinkErr) {
          console.warn(`Could not delete temp file ${file.path}:`, unlinkErr.message);
        }
      });
    }
    client.release();
  }
});

// Fetch session data (courses and conflicts) for manual scheduling
router.get('/data/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionResult = await pool.query('SELECT * FROM scheduling_sessions WHERE id = ?', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const coursesResult = await pool.query('SELECT * FROM courses WHERE session_id = ? ORDER BY level, program', [sessionId]);
    const conflictsResult = await pool.query('SELECT * FROM conflicts WHERE session_id = ?', [sessionId]);

    res.json({
      success: true,
      session: sessionResult.rows[0],
      courses: coursesResult.rows,
      conflicts: conflictsResult.rows
    });
  } catch (error) {
    console.error('Error fetching session data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate schedule
router.post('/generate/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { lockedAssignments = {} } = req.body;

    // Get session details
    const sessionResult = await pool.query(
      'SELECT * FROM scheduling_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get all courses for this session
    const coursesResult = await pool.query(
      'SELECT * FROM courses WHERE session_id = ? ORDER BY level, program',
      [sessionId]
    );

    // Get all conflicts for this session
    const conflictsResult = await pool.query(
      'SELECT * FROM conflicts WHERE session_id = ?',
      [sessionId]
    );

    // Check if we have courses
    const pharmdCount = coursesResult.rows.filter(c => c.program === 'PharmD').length;
    const clinicalCount = coursesResult.rows.filter(c => c.program === 'PharmD Clinical').length;

    console.log(`📊 Found ${coursesResult.rows.length} courses and ${conflictsResult.rows.length} conflicts`);
    console.log(`   📚 PharmD: ${pharmdCount} courses`);
    console.log(`   🏥 PharmD Clinical: ${clinicalCount} courses`);

    if (coursesResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No courses found. Please upload course files first.'
      });
    }

    if (pharmdCount === 0) {
      console.log('⚠️  WARNING: No PharmD courses found!');
    }

    if (clinicalCount === 0) {
      console.log('⚠️  WARNING: No PharmD Clinical courses found!');
    }

    // Run the advanced scheduling engine with genetic algorithm + simulated annealing
    console.log('🧬 Using Advanced Scheduler with Neural-inspired Optimization...');

    try {
      const engine = new AdvancedScheduler(
        coursesResult.rows,
        conflictsResult.rows,
        session.start_date,
        session.end_date,
        lockedAssignments
      );

      const result = engine.generateSchedule();
      console.log(`✅ Schedule generated: ${result.schedule.length} exams, ${result.violations.length} violations`);

      // Save schedule to database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing schedule for this session
      await client.query('DELETE FROM schedules WHERE session_id = ?', [sessionId]);

      // Insert new schedule
      for (const item of result.schedule) {
        await client.query(
          `INSERT INTO schedules (session_id, course_id, exam_date, day_of_week, group_type, period)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [sessionId, item.course_id, item.exam_date, item.day_of_week, item.group_type, item.period]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

      res.json({
        success: true,
        schedule: result.schedule,
        calendar: result.calendar,
        violations: result.violations,
        stats: result.stats
      });

    } catch (engineError) {
      console.error('Error in scheduling engine:', engineError);
      console.error('Stack:', engineError.stack);
      res.status(500).json({
        success: false,
        error: `Scheduling engine error: ${engineError.message}`,
        details: engineError.stack
      });
    }

  } catch (error) {
    console.error('Error generating schedule:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// Get schedule for a session
router.get('/schedule/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      `SELECT s.*, c.*
       FROM schedules s
       JOIN courses c ON s.course_id = c.id
       WHERE s.session_id = ?
       ORDER BY s.exam_date, c.level, c.program`,
      [sessionId]
    );

    res.json({ success: true, schedule: result.rows });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all sessions
router.get('/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scheduling_sessions ORDER BY created_at DESC'
    );

    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save schedule variant to Vault
router.post('/vault/save', async (req, res) => {
  try {
    const { session_id, name, schedule_data, locked_assignments, violation_count } = req.body;
    
    const result = await pool.query(
      `INSERT INTO saved_schedules (session_id, name, schedule_data, locked_assignments, violation_count)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [
        session_id,
        name || 'Saved Schedule Option',
        JSON.stringify(schedule_data || {}),
        JSON.stringify(locked_assignments || {}),
        violation_count || 0
      ]
    );

    res.json({ success: true, savedSchedule: result.rows[0] });
  } catch (error) {
    console.error('Error saving to vault:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get vault schedules for a session or ALL sessions
router.get('/vault/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let sql = `
      SELECT v.*, s.session_name 
      FROM saved_schedules v
      LEFT JOIN scheduling_sessions s ON v.session_id = s.id
    `;
    let params = [];

    if (sessionId && sessionId !== 'all') {
      sql += ` WHERE v.session_id = ?`;
      params.push(sessionId);
    }

    sql += ` ORDER BY v.created_at DESC`;

    const result = await pool.query(sql, params);

    const vaultItems = result.rows.map(item => ({
      ...item,
      schedule_data: typeof item.schedule_data === 'string' ? JSON.parse(item.schedule_data) : item.schedule_data,
      locked_assignments: typeof item.locked_assignments === 'string' ? JSON.parse(item.locked_assignments) : item.locked_assignments
    }));

    res.json({ success: true, vault: vaultItems });
  } catch (error) {
    console.error('Error fetching vault:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete vault schedule
router.delete('/vault/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM saved_schedules WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting vault item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup full session snapshot to JSON
router.get('/backup/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionRes = await pool.query(`SELECT * FROM scheduling_sessions WHERE id = ?`, [sessionId]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const coursesRes = await pool.query(`SELECT * FROM courses WHERE session_id = ?`, [sessionId]);
    const conflictsRes = await pool.query(`SELECT * FROM conflicts WHERE session_id = ?`, [sessionId]);
    const schedulesRes = await pool.query(`SELECT * FROM schedules WHERE session_id = ?`, [sessionId]);
    const vaultRes = await pool.query(`SELECT * FROM saved_schedules WHERE session_id = ?`, [sessionId]);

    const backupSnapshot = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      session: sessionRes.rows[0],
      courses: coursesRes.rows,
      conflicts: conflictsRes.rows,
      current_schedule: schedulesRes.rows,
      vault_schedules: vaultRes.rows.map(v => ({
        ...v,
        schedule_data: typeof v.schedule_data === 'string' ? JSON.parse(v.schedule_data) : v.schedule_data,
        locked_assignments: typeof v.locked_assignments === 'string' ? JSON.parse(v.locked_assignments) : v.locked_assignments
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=exam-session-backup-${sessionId}.json`);
    res.send(JSON.stringify(backupSnapshot, null, 2));
  } catch (error) {
    console.error('Error exporting backup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restore full session from JSON snapshot
router.post('/restore', async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.session) {
      return res.status(400).json({ success: false, error: 'Invalid backup file format' });
    }

    const { session, courses, conflicts, current_schedule, vault_schedules } = backupData;

    // Insert restored session
    const sessionRes = await pool.query(
      `INSERT INTO scheduling_sessions (session_name, semester, start_date, end_date)
       VALUES (?, ?, ?, ?) RETURNING *`,
      [`${session.session_name} (Restored)`, session.semester, session.start_date, session.end_date]
    );
    const newSessionId = sessionRes.rows[0].id;

    // Map old course IDs to new course IDs
    const idMap = {};
    for (const c of (courses || [])) {
      const cRes = await pool.query(
        `INSERT INTO courses (session_id, program, level, course_code, course_title, has_oral_exam, student_count, credit_hours, is_heavy, is_large, must_be_first)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        [newSessionId, c.program, c.level, c.course_code, c.course_title, c.has_oral_exam, c.student_count, c.credit_hours, c.is_heavy, c.is_large, c.must_be_first]
      );
      idMap[c.id] = cRes.rows[0].id;
    }

    // Insert conflicts
    for (const conf of (conflicts || [])) {
      if (idMap[conf.course_a_id] && idMap[conf.course_b_id]) {
        await pool.query(
          `INSERT INTO conflicts (session_id, course_a_id, course_b_id, overlap_count)
           VALUES (?, ?, ?, ?)`,
          [newSessionId, idMap[conf.course_a_id], idMap[conf.course_b_id], conf.overlap_count]
        );
      }
    }

    // Insert current schedule
    for (const s of (current_schedule || [])) {
      if (idMap[s.course_id]) {
        await pool.query(
          `INSERT INTO schedules (session_id, course_id, exam_date, day_of_week, group_type, period)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newSessionId, idMap[s.course_id], s.exam_date, s.day_of_week, s.group_type, s.period]
        );
      }
    }

    // Insert vault schedules
    for (const v of (vault_schedules || [])) {
      await pool.query(
        `INSERT INTO saved_schedules (session_id, name, schedule_data, locked_assignments, violation_count)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newSessionId,
          v.name || 'Restored Schedule',
          JSON.stringify(v.schedule_data || {}),
          JSON.stringify(v.locked_assignments || {}),
          v.violation_count || 0
        ]
      );
    }

    res.json({ success: true, newSessionId, session: sessionRes.rows[0] });
  } catch (error) {
    console.error('Error restoring session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


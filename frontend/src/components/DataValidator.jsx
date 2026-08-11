import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  getAbbreviatedCourseName,
  exportValidationMatrixToExcel,
  exportValidationMatrixToCSV
} from '../utils/courseUtils';
import CsvScheduleEvaluator from './CsvScheduleEvaluator';

function DataValidator({ sessionId, onProceedToManual, onProceedToAuto, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [conflictMap, setConflictMap] = useState(new Map());
  const [showEvaluatorModal, setShowEvaluatorModal] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [conflictFilter, setConflictFilter] = useState('ALL'); // ALL, CONFLICTS_ONLY, ORAL_ONLY

  // Expanded conflict detail row state
  const [expandedCourseId, setExpandedCourseId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/scheduler/data/${sessionId}`);
      if (res.data.success) {
        setCourses(res.data.courses || []);
        setConflicts(res.data.conflicts || []);
        setCalendar(res.data.calendar || []);

        // Build conflict map (course_id -> array of { targetCourse, overlap })
        const map = new Map();
        res.data.courses.forEach(c => map.set(String(c.id), []));

        res.data.conflicts.forEach(conf => {
          const idA = String(conf.course_a_id);
          const idB = String(conf.course_b_id);
          const courseA = res.data.courses.find(c => String(c.id) === idA);
          const courseB = res.data.courses.find(c => String(c.id) === idB);

          if (courseA && courseB) {
            if (!map.has(idA)) map.set(idA, []);
            if (!map.has(idB)) map.set(idB, []);

            map.get(idA).push({ target: courseB, overlap: conf.overlap_count });
            map.get(idB).push({ target: courseA, overlap: conf.overlap_count });
          }
        });

        // Sort each course's conflicts by overlap descending
        map.forEach((list) => list.sort((a, b) => b.overlap - a.overlap));
        setConflictMap(map);
      } else {
        setError('Failed to load session data.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card w-full flex flex-col items-center justify-center py-20 text-slate-500">
        <svg className="animate-spin h-10 w-10 text-hue-navy mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p className="font-medium">Auditing & validating uploaded course & conflict data...</p>
      </div>
    );
  }

  // Filtered Courses
  const filteredCourses = courses.filter(c => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      c.course_code.toLowerCase().includes(query) || 
      c.course_title.toLowerCase().includes(query);

    const matchesProgram = programFilter === 'ALL' || c.program === programFilter;
    const matchesLevel = levelFilter === 'ALL' || String(c.level) === String(levelFilter);

    const courseConflicts = conflictMap.get(String(c.id)) || [];
    const matchesConflict = conflictFilter === 'ALL' ||
      (conflictFilter === 'CONFLICTS_ONLY' && courseConflicts.length > 0) ||
      (conflictFilter === 'ORAL_ONLY' && c.has_oral_exam);

    return matchesQuery && matchesProgram && matchesLevel && matchesConflict;
  });

  // KPI Calculations
  const totalStudents = courses.reduce((sum, c) => sum + (c.student_count || 0), 0);
  const oralCount = courses.filter(c => c.has_oral_exam).length;
  const coursesWithConflicts = courses.filter(c => (conflictMap.get(String(c.id)) || []).length > 0).length;

  const levelDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  courses.forEach(c => {
    if (levelDistribution[c.level] !== undefined) levelDistribution[c.level]++;
  });

  return (
    <div className="card w-full flex-1 flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="mb-1 flex items-center gap-2 dark:text-white">
            <span>🔍 Data Audit & Validation Matrix</span>
            <span className="badge badge-success text-xs font-bold px-2 py-0.5">Verified</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Review all extracted course metadata, enrolled student counts, oral flags, and student conflict pairs before scheduling.</p>
        </div>

        <div className="flex gap-2.5 shrink-0 flex-wrap">
          <button className="btn btn-secondary text-xs" onClick={onBack}>
            ← Back to Upload
          </button>
          <button 
            className="btn bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-300 dark:border-purple-800 font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95" 
            onClick={() => setShowEvaluatorModal(true)}
          >
            📊 CSV / Excel Evaluator
          </button>
          <button className="btn btn-secondary border-hue-gold text-hue-navy dark:text-amber-300 font-bold text-xs" onClick={onProceedToManual}>
            ⚡ Step 4: Pre-Scheduling
          </button>
          <button className="btn btn-primary shadow-glow-primary text-xs font-bold" onClick={onProceedToAuto}>
            🚀 Step 5: Auto-Generate
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">📚 Uploaded Courses</div>
          <div className="text-2xl font-bold font-outfit text-hue-navy dark:text-amber-400">{courses.length}</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">👥 Enrolled Students</div>
          <div className="text-2xl font-bold font-outfit text-blue-600 dark:text-blue-400">{totalStudents.toLocaleString()}</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">⚔️ Conflict Pairs</div>
          <div className="text-2xl font-bold font-outfit text-amber-600 dark:text-amber-400">{conflicts.length}</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">🎤 Oral Exams</div>
          <div className="text-2xl font-bold font-outfit text-purple-600 dark:text-purple-400">{oralCount}</div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center col-span-2 md:col-span-1">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">🎓 Level Distribution</div>
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex justify-center gap-1.5 mt-1">
            <span>L1:<strong className="text-blue-600 dark:text-blue-400">{levelDistribution[1]}</strong></span>
            <span>L2:<strong className="text-emerald-600 dark:text-emerald-400">{levelDistribution[2]}</strong></span>
            <span>L3:<strong className="text-purple-600 dark:text-purple-400">{levelDistribution[3]}</strong></span>
            <span>L4:<strong className="text-amber-600 dark:text-amber-400">{levelDistribution[4]}</strong></span>
            <span>L5:<strong className="text-rose-600 dark:text-rose-400">{levelDistribution[5]}</strong></span>
          </div>
        </div>
      </div>

      {/* Health Checks & Insights Panel */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-bold shrink-0">
            ✓
          </div>
          <div>
            <div className="font-bold text-sm text-white">System Data Health Report</div>
            <div className="text-xs text-slate-300">
              {coursesWithConflicts} of {courses.length} courses have student overlap conflicts • {oralCount} oral exams locked to Period 1.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-lg">
            🛡️ Ready for Scheduling
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">🔎 Search:</span>
          <input
            type="text"
            placeholder="Search code or title (e.g. PT-124, Information Tech)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field text-xs py-1.5 flex-1"
          />
          {(searchQuery || programFilter !== 'ALL' || levelFilter !== 'ALL' || conflictFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setProgramFilter('ALL');
                setLevelFilter('ALL');
                setConflictFilter('ALL');
              }}
              className="btn btn-secondary btn-sm text-xs font-semibold text-slate-600 hover:text-red-600 shrink-0"
              title="Reset all search & filters"
            >
              🔄 Reset Filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Program Filter */}
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-hue-gold"
          >
            <option value="ALL">All Programs</option>
            <option value="PharmD">PharmD</option>
            <option value="PharmD Clinical">PharmD Clinical</option>
          </select>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-hue-gold"
          >
            <option value="ALL">All Levels (1-5)</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>

          {/* Conflict Filter */}
          <select
            value={conflictFilter}
            onChange={(e) => setConflictFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-hue-gold"
          >
            <option value="ALL">All Courses</option>
            <option value="CONFLICTS_ONLY">Has Conflicts Only</option>
            <option value="ORAL_ONLY">Oral Exams Only</option>
          </select>

          {/* Download Buttons */}
          <div className="flex items-center gap-2 border-l border-slate-300 dark:border-slate-700 pl-2">
            <button
              onClick={() => exportValidationMatrixToExcel(filteredCourses, conflictMap, sessionId)}
              className="btn btn-sm text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-sm"
              title="Download Data Validation Table as Excel (.xlsx)"
            >
              📊 Download Excel (.xlsx)
            </button>
            <button
              onClick={() => exportValidationMatrixToCSV(filteredCourses, conflictMap, sessionId)}
              className="btn btn-sm text-xs font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-300 dark:border-blue-800 flex items-center gap-1.5 shadow-sm"
              title="Download Data Validation Table as CSV"
            >
              📄 Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Audit Data Table */}
      <div className="table-container border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="table-header">
            <tr>
              <th className="py-3 px-4 text-left">Course Code & Title</th>
              <th className="py-3 px-3 text-center">Program</th>
              <th className="py-3 px-3 text-center">Level</th>
              <th className="py-3 px-3 text-center">Students Enrolled</th>
              <th className="py-3 px-3 text-center">Oral Exam</th>
              <th className="py-3 px-3 text-center">Conflicts Count</th>
              <th className="py-3 px-4 text-left">Conflicted Courses & Overlap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filteredCourses.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-slate-400">
                  No courses match your active search filter.
                </td>
              </tr>
            ) : (
              filteredCourses.map((course) => {
                const courseConflicts = conflictMap.get(String(course.id)) || [];
                const isExpanded = expandedCourseId === course.id;

                const levelBadgeClass = {
                  1: 'bg-blue-50 text-blue-700 border-blue-200',
                  2: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  3: 'bg-purple-50 text-purple-700 border-purple-200',
                  4: 'bg-amber-50 text-amber-700 border-amber-200',
                  5: 'bg-rose-50 text-rose-700 border-rose-200',
                }[course.level] || 'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Course Code & Title */}
                    <td className="py-3 px-4 align-top">
                      <div className="font-bold text-hue-navy text-sm">{course.course_code}</div>
                      <div className="text-slate-600 font-medium leading-snug">{course.course_title}</div>
                    </td>

                    {/* Program */}
                    <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-bold border text-[10px] ${
                        course.program === 'PharmD Clinical' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {course.program}
                      </span>
                    </td>

                    {/* Level */}
                    <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold border text-[10px] ${levelBadgeClass}`}>
                        Level {course.level}
                      </span>
                    </td>

                    {/* Students */}
                    <td className="py-3 px-3 text-center align-top font-bold text-slate-700">
                      👥 {course.student_count || 0}
                    </td>

                    {/* Oral Exam */}
                    <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                      {course.has_oral_exam ? (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                          🎤 Period 1 Only
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-[11px]">No</span>
                      )}
                    </td>

                    {/* Conflicts Count */}
                    <td className="py-3 px-3 text-center align-top font-bold">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] ${
                        courseConflicts.length > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {courseConflicts.length} conflict{courseConflicts.length !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Conflicted Courses List */}
                    <td className="py-3 px-4 align-top">
                      {courseConflicts.length === 0 ? (
                        <span className="text-emerald-600 font-semibold text-[11px]">✓ No Student Overlap</span>
                      ) : (
                        <div>
                          {/* Short Preview */}
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {(isExpanded ? courseConflicts : courseConflicts.slice(0, 3)).map((item, idx) => (
                              <span 
                                key={idx} 
                                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 text-[11px] font-medium text-slate-700"
                                title={`Code: ${item.target.course_code} | Title: ${item.target.course_title} (${item.target.program})`}
                              >
                                <strong className="text-hue-navy">{getAbbreviatedCourseName(item.target.course_title)}</strong> ({item.target.program}): <span className="text-red-600 font-bold">{item.overlap} overlap</span>
                              </span>
                            ))}
                          </div>

                          {/* Expand/Collapse toggle if more than 3 conflicts */}
                          {courseConflicts.length > 3 && (
                            <button
                              onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                              className="text-[10px] text-hue-navy hover:underline font-bold"
                            >
                              {isExpanded ? '▲ Show Less' : `▼ Show All ${courseConflicts.length} Conflicted Courses`}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* CSV / Excel Manual Timetable Evaluator Modal */}
      {showEvaluatorModal && (
        <CsvScheduleEvaluator
          sessionId={sessionId}
          courses={courses}
          conflicts={conflicts}
          calendar={calendar}
          onApplySchedule={(assignmentsMap) => {
            setShowEvaluatorModal(false);
            onProceedToManual(assignmentsMap);
          }}
          onClose={() => setShowEvaluatorModal(false)}
        />
      )}
    </div>
  );
}

export default DataValidator;

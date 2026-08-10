import { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

function CsvScheduleEvaluator({ sessionId, courses = [], conflicts = [], calendar = [], onApplySchedule, onClose }) {
  const [importedFile, setImportedFile] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix', 'diagnostics', 'unassigned'
  const [selectedDiagnosticItem, setSelectedDiagnosticItem] = useState(null);

  // Conflict lookup helper (overlap between 2 course IDs)
  const getOverlap = (idA, idB) => {
    if (!conflicts || conflicts.length === 0) return 0;
    const match = conflicts.find(c => 
      (String(c.course_a_id) === String(idA) && String(c.course_b_id) === String(idB)) ||
      (String(c.course_a_id) === String(idB) && String(c.course_b_id) === String(idA))
    );
    return match ? match.overlap_count : 0;
  };

  // Helper to normalize course matching from string
  const findCourseExactMatch = (code, title, program, level) => {
    let matches = courses;

    if (code) {
      const normCode = String(code).trim().toLowerCase();
      matches = matches.filter(c => c.course_code && c.course_code.trim().toLowerCase() === normCode);
    } else if (title) {
      const normTitle = String(title).trim().toLowerCase();
      matches = matches.filter(c => c.course_title && c.course_title.trim().toLowerCase() === normTitle);
    }

    if (matches.length > 1 && program) {
      const normProg = String(program).trim().toLowerCase();
      matches = matches.filter(c => c.program && c.program.trim().toLowerCase() === normProg);
    }

    if (matches.length > 1 && level !== undefined && level !== '') {
      matches = matches.filter(c => String(c.level) === String(level));
    }

    return matches.length > 0 ? matches[0] : null;
  };

  const findCourseByCodeOrTitle = (codeOrTitle) => {
    if (!codeOrTitle) return null;
    const norm = String(codeOrTitle).trim().toLowerCase();
    return courses.find(c => 
      (c.course_code && c.course_code.trim().toLowerCase() === norm) ||
      (c.course_title && c.course_title.trim().toLowerCase() === norm)
    );
  };

  // EXPORT TEMPLATE TO EXCEL (.xlsx)
  const handleExportExcel = () => {
    try {
      const rows = courses.map(c => ({
        'Course Code': c.course_code || '',
        'Course Title': c.course_title || '',
        'Program': c.program || '',
        'Level': c.level || 1,
        'Student Count': c.student_count || 0,
        'Oral Exam': c.has_oral_exam ? 'Yes' : 'No',
        'Exam Date (YYYY-MM-DD)': '',
        'Exam Period (1 or 2)': ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      
      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 15 }, // Code
        { wch: 35 }, // Title
        { wch: 18 }, // Program
        { wch: 10 }, // Level
        { wch: 14 }, // Students
        { wch: 12 }, // Oral
        { wch: 22 }, // Date
        { wch: 20 }  // Period
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Exam Timetable');

      XLSX.writeFile(workbook, `HUE_Manual_Timetable_Template_Step3.xlsx`);
    } catch (err) {
      console.error('Export Excel error:', err);
      setError('Failed to export Excel template.');
    }
  };

  // EXPORT TEMPLATE TO CSV (.csv)
  const handleExportCSV = () => {
    try {
      const headers = ['Course Code', 'Course Title', 'Program', 'Level', 'Student Count', 'Oral Exam', 'Exam Date (YYYY-MM-DD)', 'Exam Period (1 or 2)'];
      const rows = courses.map(c => [
        `"${(c.course_code || '').replace(/"/g, '""')}"`,
        `"${(c.course_title || '').replace(/"/g, '""')}"`,
        `"${(c.program || '').replace(/"/g, '""')}"`,
        c.level || 1,
        c.student_count || 0,
        c.has_oral_exam ? 'Yes' : 'No',
        '""',
        '""'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `HUE_Manual_Timetable_Template_Step3.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV error:', err);
      setError('Failed to export CSV template.');
    }
  };

  // IMPORT AND EVALUATE FILE (.xlsx / .csv)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFile(file);
    setError('');
    setEvaluating(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        evaluateImportedRows(rawJson);
      } catch (err) {
        console.error('Parse file error:', err);
        setError('Error reading Excel/CSV file. Please ensure it is a valid template.');
        setEvaluating(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Helper to diagnose specific item rule violations
  const getItemDiagnostics = (item, hardConflicts, oralViolations, studyGapWarnings) => {
    const cId = String(item.course.id);
    
    const conflictsList = hardConflicts.filter(c => String(c.courseA.id) === cId || String(c.courseB.id) === cId);
    const oralList = oralViolations.filter(o => String(o.course.id) === cId);
    const gapList = studyGapWarnings.filter(g => g.laterCourseId === cId);

    return {
      hasHardConflict: conflictsList.length > 0,
      hasOralViolation: oralList.length > 0,
      hasGapWarning: gapList.length > 0,
      conflictsList,
      oralList,
      gapList,
      isClean: conflictsList.length === 0 && oralList.length === 0 && gapList.length === 0
    };
  };

  // CORE EVALUATION ENGINE
  const evaluateImportedRows = (rows) => {
    const assignmentsMap = {}; // courseId -> { dayIndex, period, dateStr }
    const assignedCoursesList = [];
    const unassignedCoursesList = [...courses];
    const invalidRows = [];

    // Parse each row from file
    rows.forEach((row, idx) => {
      // Flexibly find columns regardless of casing or exact header formatting
      const code = row['Course Code'] || row['course_code'] || row['Code'] || row['CODE'] || '';
      const title = row['Course Title'] || row['course_title'] || row['Title'] || row['TITLE'] || '';
      const program = row['Program'] || row['program'] || row['PROGRAM'] || '';
      const level = row['Level'] || row['level'] || row['LEVEL'] || '';
      let dateVal = row['Exam Date (YYYY-MM-DD)'] || row['Exam Date'] || row['exam_date'] || row['Date'] || '';
      let periodVal = row['Exam Period (1 or 2)'] || row['Exam Period'] || row['period'] || row['Period'] || '';

      const targetCourse = findCourseExactMatch(code, title, program, level) || findCourseByCodeOrTitle(code) || findCourseByCodeOrTitle(title);

      if (!targetCourse) {
        if (code || title) {
          invalidRows.push({ row: idx + 2, reason: `Course "${code || title}" not found in Step 3 database.` });
        }
        return;
      }

      // Format Date string YYYY-MM-DD
      let dateStr = '';
      if (dateVal instanceof Date) {
        dateStr = dateVal.toISOString().split('T')[0];
      } else if (dateVal) {
        dateStr = String(dateVal).trim().split('T')[0];
      }

      // Format Period number 1 or 2
      let period = Number(periodVal);
      if (isNaN(period) || (period !== 1 && period !== 2)) {
        if (String(periodVal).toLowerCase().includes('p1') || String(periodVal).includes('1')) period = 1;
        else if (String(periodVal).toLowerCase().includes('p2') || String(periodVal).includes('2')) period = 2;
        else period = null;
      }

      if (dateStr && period) {
        // Find matching calendar dayIndex
        const dayMatch = calendar.find(d => d.dateStr === dateStr);
        const dayIndex = dayMatch ? dayMatch.dayIndex : -1;

        assignmentsMap[targetCourse.id] = {
          dayIndex: dayIndex >= 0 ? dayIndex : 0,
          period,
          dateStr
        };

        assignedCoursesList.push({
          course: targetCourse,
          dateStr,
          period,
          dayIndex: dayIndex >= 0 ? dayIndex : 0,
          isDateInCalendar: dayIndex >= 0
        });

        // Remove from unassigned
        const uIdx = unassignedCoursesList.findIndex(c => c.id === targetCourse.id);
        if (uIdx !== -1) unassignedCoursesList.splice(uIdx, 1);
      } else {
        invalidRows.push({ row: idx + 2, reason: `Course ${targetCourse.course_code}: Missing valid Date or Period (1/2).` });
      }
    });

    // AUDIT CONFLICTS AND RULES
    const hardConflicts = [];
    const oralViolations = [];
    const periodCapacityViolations = [];
    const studyGapWarnings = [];
    const periodOccupancy = {}; // dateStr_period -> { totalStudents, courses: [] }

    // 1. Group courses by date + period
    assignedCoursesList.forEach(item => {
      const key = `${item.dateStr}_${item.period}`;
      if (!periodOccupancy[key]) {
        periodOccupancy[key] = { totalStudents: 0, courses: [] };
      }
      periodOccupancy[key].courses.push(item);
      periodOccupancy[key].totalStudents += (item.course.student_count || 0);

      // Check Oral Exam Rule (Must be Period 1)
      if (item.course.has_oral_exam && item.period !== 1) {
        oralViolations.push({
          course: item.course,
          dateStr: item.dateStr,
          period: item.period,
          rule: 'Oral exams MUST be scheduled in Period 1.'
        });
      }
    });

    // 2. Audit Period Capacity (>1000 students)
    Object.entries(periodOccupancy).forEach(([key, data]) => {
      if (data.totalStudents > 1000) {
        const [dStr, pNum] = key.split('_');
        periodCapacityViolations.push({
          dateStr: dStr,
          period: Number(pNum),
          totalStudents: data.totalStudents,
          courses: data.courses.map(i => i.course.course_code),
          limit: 1000
        });
      }
    });

    // 3. Audit Hard Student Overlaps (Same Day & Period)
    Object.values(periodOccupancy).forEach(data => {
      const list = data.courses;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const itemA = list[i];
          const itemB = list[j];
          const overlap = getOverlap(itemA.course.id, itemB.course.id);

          if (overlap > 0) {
            hardConflicts.push({
              courseA: itemA.course,
              courseB: itemB.course,
              dateStr: itemA.dateStr,
              period: itemA.period,
              overlap,
              severity: overlap >= 50 ? 'CRITICAL' : overlap >= 10 ? 'MAJOR' : 'MINOR'
            });
          }
        }
      }
    });

    // 4. Audit Study Gap Warnings (Shared students on consecutive days)
    for (let i = 0; i < assignedCoursesList.length; i++) {
      for (let j = i + 1; j < assignedCoursesList.length; j++) {
        const itemA = assignedCoursesList[i];
        const itemB = assignedCoursesList[j];
        if (itemA.dateStr === itemB.dateStr) continue; // Handled in same-day

        const overlap = getOverlap(itemA.course.id, itemB.course.id);
        if (overlap > 0) {
          const dayDiff = Math.abs(itemA.dayIndex - itemB.dayIndex);
          const requiredGap = overlap >= 50 ? 3 : overlap >= 10 ? 2 : 1;

          if (dayDiff < requiredGap) {
            const laterItem = itemA.dayIndex > itemB.dayIndex ? itemA : itemB;
            const earlierItem = itemA.dayIndex > itemB.dayIndex ? itemB : itemA;

            studyGapWarnings.push({
              courseA: earlierItem.course,
              courseB: laterItem.course,
              dateA: earlierItem.dateStr,
              dateB: laterItem.dateStr,
              overlap,
              dayDiff,
              requiredGap,
              laterCourseId: String(laterItem.course.id)
            });
          }
        }
      }
    }

    // 5. Build Matrix Table Preview Structure
    const matrixPreview = {};
    const importedDates = [...new Set(assignedCoursesList.map(i => i.dateStr))].sort();

    importedDates.forEach(d => {
      matrixPreview[d] = { 1: {}, 2: {} };
    });

    assignedCoursesList.forEach(item => {
      const plKey = `${item.course.program}|Level ${item.course.level}`;
      if (matrixPreview[item.dateStr] && matrixPreview[item.dateStr][item.period]) {
        if (!matrixPreview[item.dateStr][item.period][plKey]) {
          matrixPreview[item.dateStr][item.period][plKey] = [];
        }
        
        const diag = getItemDiagnostics(item, hardConflicts, oralViolations, studyGapWarnings);
        matrixPreview[item.dateStr][item.period][plKey].push({
          ...item,
          diagnostics: diag
        });
      }
    });

    // CALCULATE COMPLIANCE SCORE
    const totalAssigned = assignedCoursesList.length;
    const totalCourseCount = courses.length;
    const penaltyPoints = (hardConflicts.length * 25) + (oralViolations.length * 20) + (periodCapacityViolations.length * 15) + (studyGapWarnings.length * 5) + (unassignedCoursesList.length * 10);
    const score = Math.max(0, 100 - penaltyPoints);

    setEvalResult({
      assignmentsMap,
      assignedCoursesCount: totalAssigned,
      totalCourseCount,
      unassignedCourses: unassignedCoursesList,
      hardConflicts,
      oralViolations,
      periodCapacityViolations,
      studyGapWarnings,
      invalidRows,
      matrixPreview,
      importedDates,
      score,
      isPerfect: hardConflicts.length === 0 && oralViolations.length === 0 && periodCapacityViolations.length === 0 && unassignedCoursesList.length === 0
    });

    setEvaluating(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-[#002147] text-white p-4 flex justify-between items-center shrink-0 border-b border-[#FFB81C]/40">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="font-extrabold text-base tracking-wide font-outfit text-white">
                CSV / Excel Manual Timetable Evaluator
              </h3>
              <p className="text-xs text-[#FFB81C] font-semibold">
                Export template, edit manually offline in Excel, import back & evaluate against Step 3 extracted conflict data
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* STEP 1 & STEP 2 ACTION CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* EXPORT TEMPLATE CARD */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-900 font-black text-xs flex items-center justify-center">1</span>
                  <h4 className="font-extrabold text-sm text-[#002147]">Export Step 3 Course Template</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Download a pre-structured template containing all <strong className="text-slate-800">{courses.length} courses</strong> extracted in Step 3. Fill in the <code className="bg-slate-100 text-slate-800 px-1 rounded">Exam Date</code> and <code className="bg-slate-100 text-slate-800 px-1 rounded">Exam Period (1/2)</code> columns in Excel or Google Sheets.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleExportExcel}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#002147] hover:bg-[#001530] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <span>📥</span> Export Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300 transition-all active:scale-95"
                >
                  <span>📄</span> Export CSV (.csv)
                </button>
              </div>
            </div>

            {/* IMPORT & EVALUATE CARD */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center">2</span>
                  <h4 className="font-extrabold text-sm text-[#002147]">Import & Audit Manual Timetable</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Upload your manually created CSV or Excel timetable. The audit engine will immediately evaluate it against student conflict matrices, oral exam rules, period capacities, and rest days.
                </p>
              </div>

              <div>
                <label className="relative flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 hover:border-[#002147] rounded-xl cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition-all">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileUpload}
                    className="hidden" 
                  />
                  <div className="flex items-center gap-2 text-xs font-bold text-[#002147]">
                    <span>📤</span> {importedFile ? importedFile.name : 'Select or Drop CSV / Excel File'}
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">Supports .xlsx, .csv file formats</p>
                </label>
              </div>
            </div>

          </div>

          {/* EVALUATION RESULTS DASHBOARD */}
          {evaluating && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
              <svg className="animate-spin h-8 w-8 text-[#002147]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p className="text-xs font-bold text-slate-700">Evaluating imported schedule against Step 3 extracted conflict matrices...</p>
            </div>
          )}

          {evalResult && !evaluating && (
            <div className="space-y-5 animate-fade-in">
              
              {/* EVALUATION KPI SUMMARY HEADER */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-extrabold text-base text-[#002147]">Step 3 Audit & Evaluation Summary</h3>
                      
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                        evalResult.isPerfect 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : evalResult.hardConflicts.length > 0 
                            ? 'bg-red-100 text-red-900 border-red-300' 
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {evalResult.isPerfect ? '100% VALID (PERFECT MATCH)' : `COMPLIANCE SCORE: ${evalResult.score}%`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Assigned <span className="font-bold text-slate-800">{evalResult.assignedCoursesCount}</span> of <span className="font-bold text-slate-800">{evalResult.totalCourseCount}</span> total courses from Step 3 database.
                    </p>
                  </div>

                  {/* APPLY SCHEDULE ACTION BUTTON */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApplySchedule(evalResult.assignmentsMap)}
                      className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <span>🚀</span> Apply Evaluated Schedule to Application
                    </button>
                  </div>
                </div>

                {/* KPI METRIC TILES */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-4 text-center">
                  
                  {/* Hard Conflicts */}
                  <div className={`p-3 rounded-xl border ${evalResult.hardConflicts.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-lg font-black">{evalResult.hardConflicts.length}</div>
                    <div className="text-[10.5px] font-extrabold uppercase mt-0.5">Hard Conflicts</div>
                  </div>

                  {/* Oral Violations */}
                  <div className={`p-3 rounded-xl border ${evalResult.oralViolations.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-lg font-black">{evalResult.oralViolations.length}</div>
                    <div className="text-[10.5px] font-extrabold uppercase mt-0.5">Oral Violations</div>
                  </div>

                  {/* Capacity Overshoots */}
                  <div className={`p-3 rounded-xl border ${evalResult.periodCapacityViolations.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-lg font-black">{evalResult.periodCapacityViolations.length}</div>
                    <div className="text-[10.5px] font-extrabold uppercase mt-0.5">Capacity Over 1k</div>
                  </div>

                  {/* Study Gap Warnings */}
                  <div className={`p-3 rounded-xl border ${evalResult.studyGapWarnings.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-lg font-black">{evalResult.studyGapWarnings.length}</div>
                    <div className="text-[10.5px] font-extrabold uppercase mt-0.5">Gap Warnings</div>
                  </div>

                  {/* Unassigned Courses */}
                  <div className={`p-3 rounded-xl border ${evalResult.unassignedCourses.length > 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <div className="text-lg font-black">{evalResult.unassignedCourses.length}</div>
                    <div className="text-[10.5px] font-extrabold uppercase mt-0.5">Unassigned</div>
                  </div>

                </div>

              </div>

              {/* INTERACTIVE NAVIGATION TABS */}
              <div className="flex border-b border-slate-200 gap-2 shrink-0 bg-white p-2 rounded-xl shadow-2xs">
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'matrix' 
                      ? 'bg-[#002147] text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>📅</span> Interactive Timetable Matrix Preview
                </button>
                
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'diagnostics' 
                      ? 'bg-[#002147] text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🚨</span> Rule Breakdown &amp; Comments
                  {(evalResult.hardConflicts.length + evalResult.oralViolations.length + evalResult.studyGapWarnings.length) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {evalResult.hardConflicts.length + evalResult.oralViolations.length + evalResult.studyGapWarnings.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                    activeTab === 'unassigned' 
                      ? 'bg-[#002147] text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>📋</span> Unassigned Courses ({evalResult.unassignedCourses.length})
                </button>
              </div>

              {/* TAB 1: INTERACTIVE TIMETABLE MATRIX PREVIEW */}
              {activeTab === 'matrix' && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#002147]">Imported Timetable Matrix Preview</h4>
                      <p className="text-xs text-slate-500 font-medium">Click any course card to inspect rule diagnostic comments, conflict details, and placement suggestions.</p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Conflict-Free</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Hard Conflict</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block"></span> Oral Violation</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Gap Warning</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full border-collapse text-[9px] table-fixed min-w-[900px]">
                      <thead className="bg-[#002147] text-white">
                        <tr>
                          <th className="p-2 border border-slate-400 w-[8%] text-center uppercase font-bold text-[#FFB81C]">Date</th>
                          <th className="p-2 border border-slate-400 w-[5%] text-center uppercase font-bold text-[#FFB81C]">Period</th>
                          {[
                            'PharmD|Level 1', 'PharmD Clinical|Level 1',
                            'PharmD|Level 2', 'PharmD Clinical|Level 2',
                            'PharmD|Level 3', 'PharmD Clinical|Level 3',
                            'PharmD|Level 4', 'PharmD Clinical|Level 4',
                            'PharmD|Level 5', 'PharmD Clinical|Level 5'
                          ].map(pl => {
                            const [prog, lvl] = pl.split('|');
                            const isClinical = prog.toLowerCase().includes('clinical');
                            return (
                              <th key={pl} className="p-1 border border-slate-400 text-center font-bold bg-[#002147]">
                                <div className={`text-[8px] font-black leading-tight ${isClinical ? 'text-[#FFB81C]' : 'text-white'}`}>{prog}</div>
                                <div className="text-slate-200 font-bold text-[7.5px]">{lvl}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.importedDates.map(dateStr => {
                          const dateObj = new Date(dateStr + 'T00:00:00');
                          const dayName = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const formattedDate = isNaN(dateObj.getTime()) ? dateStr : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                          return [1, 2].map(periodNum => (
                            <tr key={`${dateStr}-${periodNum}`} className="border-b border-slate-200">
                              {periodNum === 1 && (
                                <td rowSpan={2} className="border border-slate-300 p-1 text-center align-middle bg-slate-50 font-bold border-l-4 border-l-[#FFB81C]">
                                  <div className="text-[10px] text-[#002147] font-extrabold">{dayName}</div>
                                  <div className="text-[7.5px] text-slate-500">{formattedDate}</div>
                                </td>
                              )}

                              <td className="border border-slate-300 p-1 text-center align-middle bg-white font-bold">
                                <span className={`px-1 py-0.2 rounded text-[7.5px] ${periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                  P{periodNum}
                                </span>
                              </td>

                              {[
                                'PharmD|Level 1', 'PharmD Clinical|Level 1',
                                'PharmD|Level 2', 'PharmD Clinical|Level 2',
                                'PharmD|Level 3', 'PharmD Clinical|Level 3',
                                'PharmD|Level 4', 'PharmD Clinical|Level 4',
                                'PharmD|Level 5', 'PharmD Clinical|Level 5'
                              ].map(plKey => {
                                const assignedItems = evalResult.matrixPreview[dateStr]?.[periodNum]?.[plKey] || [];

                                return (
                                  <td key={plKey} className="border border-slate-300 p-1 align-top bg-white">
                                    {assignedItems.length > 0 ? (
                                      <div className="space-y-1">
                                        {assignedItems.map(item => {
                                          const diag = item.diagnostics;
                                          const isSelected = selectedDiagnosticItem?.course.id === item.course.id;

                                          let cardStyle = 'bg-white border-emerald-300 text-slate-800 shadow-2xs';
                                          if (diag.hasHardConflict) cardStyle = 'bg-red-50 border-red-400 text-red-950 font-semibold shadow-xs';
                                          else if (diag.hasOralViolation) cardStyle = 'bg-purple-50 border-purple-400 text-purple-950 font-semibold shadow-xs';
                                          else if (diag.hasGapWarning) cardStyle = 'bg-amber-50 border-amber-400 text-amber-950 font-semibold shadow-xs';

                                          return (
                                            <div
                                              key={item.course.id}
                                              onClick={() => setSelectedDiagnosticItem(item)}
                                              className={`p-1.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${cardStyle} ${
                                                isSelected ? 'ring-2 ring-[#002147] shadow-md scale-[1.02]' : ''
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <span className="font-extrabold text-[9px] text-[#002147]">{item.course.course_code}</span>
                                                <span className="text-[7px] bg-white/80 border border-slate-300 px-1 py-0.2 rounded font-bold">
                                                  👥 {item.course.student_count}
                                                </span>
                                              </div>
                                              <div className="text-[8px] leading-tight truncate font-medium text-slate-700">{item.course.course_title}</div>

                                              {/* STATUS BADGES */}
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {diag.hasHardConflict && (
                                                  <span className="text-[6.5px] bg-red-600 text-white font-black px-1 py-0.2 rounded">
                                                    🚨 Conflict ({diag.conflictsList[0]?.overlap})
                                                  </span>
                                                )}
                                                {diag.hasOralViolation && (
                                                  <span className="text-[6.5px] bg-purple-600 text-white font-black px-1 py-0.2 rounded">
                                                    🎤 Oral P2 Error
                                                  </span>
                                                )}
                                                {diag.hasGapWarning && !diag.hasHardConflict && (
                                                  <span className="text-[6.5px] bg-amber-600 text-white font-black px-1 py-0.2 rounded">
                                                    ⚠️ Rest Gap Warning
                                                  </span>
                                                )}
                                                {diag.isClean && (
                                                  <span className="text-[6.5px] bg-emerald-600 text-white font-extrabold px-1 py-0.2 rounded">
                                                    ✓ Valid
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-slate-300 text-center py-1 text-[7.5px] font-light">—</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* DIAGNOSTIC COMMENT SIDE PANEL FOR SELECTED COURSE */}
                  {selectedDiagnosticItem && (
                    <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl space-y-3 animate-fade-in">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-base">💬</span>
                          <h4 className="font-extrabold text-sm text-white font-outfit">
                            Rule Diagnostic Comments: <span className="text-[#FFB81C]">{selectedDiagnosticItem.course.course_code}</span> — {selectedDiagnosticItem.course.course_title}
                          </h4>
                        </div>
                        <button
                          onClick={() => setSelectedDiagnosticItem(null)}
                          className="text-slate-400 hover:text-white font-bold text-xs"
                        >
                          ✕ Close Comment Panel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-slate-800/80 rounded-xl space-y-1">
                          <div className="font-bold text-[#FFB81C] text-[11px] uppercase tracking-wider">📌 Course Metadata &amp; Assigned Slot</div>
                          <div>Program &amp; Level: <strong className="text-white">{selectedDiagnosticItem.course.program} (Level {selectedDiagnosticItem.course.level})</strong></div>
                          <div>Enrolled Students: <strong className="text-white">{selectedDiagnosticItem.course.student_count}</strong></div>
                          <div>Assigned Exam Slot: <strong className="text-white">{selectedDiagnosticItem.dateStr} (Period {selectedDiagnosticItem.period})</strong></div>
                          <div>Oral Exam: <strong className="text-white">{selectedDiagnosticItem.course.has_oral_exam ? 'Yes (Requires Period 1)' : 'No'}</strong></div>
                        </div>

                        <div className="p-3 bg-slate-800/80 rounded-xl space-y-2">
                          <div className="font-bold text-[#FFB81C] text-[11px] uppercase tracking-wider">🔍 Scheduling Rule Diagnostic Comments</div>
                          
                          {selectedDiagnosticItem.diagnostics.isClean ? (
                            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                              <span>✅</span> This course placement is 100% compliant with zero student conflicts or rule violations.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {selectedDiagnosticItem.diagnostics.conflictsList.map((c, i) => (
                                <div key={i} className="p-2 bg-red-950/80 border border-red-500/50 rounded-lg text-red-200 font-medium">
                                  <strong className="text-white">🚨 HARD CONFLICT:</strong> Shares <strong className="underline decoration-red-400 text-white">{c.overlap} students</strong> with <strong>{c.courseA.id === selectedDiagnosticItem.course.id ? c.courseB.course_code : c.courseA.course_code}</strong> on {c.dateStr} (Period {c.period}).
                                </div>
                              ))}

                              {selectedDiagnosticItem.diagnostics.oralList.map((o, i) => (
                                <div key={i} className="p-2 bg-purple-950/80 border border-purple-500/50 rounded-lg text-purple-200 font-medium">
                                  <strong className="text-white">🎤 ORAL EXAM VIOLATION:</strong> Placed in Period {o.period}. Faculty scheduling rules strictly require oral exam courses to be placed in Period 1.
                                </div>
                              ))}

                              {selectedDiagnosticItem.diagnostics.gapList.map((g, i) => (
                                <div key={i} className="p-2 bg-amber-950/80 border border-amber-500/50 rounded-lg text-amber-200 font-medium">
                                  <strong className="text-white">⚠️ STUDY GAP BUFFER PENALTY:</strong> Scheduled on consecutive days with insufficient rest buffer ({g.dayDiff} day gap vs required {g.requiredGap} days rest for {g.overlap} shared students).
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RULE DIAGNOSTICS & COMMENTS */}
              {activeTab === 'diagnostics' && (
                <div className="space-y-4">
                  {/* HARD STUDENT CONFLICTS TABLE */}
                  {evalResult.hardConflicts.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-red-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-red-900 font-extrabold text-xs">
                        <span>🚨</span> Hard Student Overlap Conflicts (Scheduled Same Day &amp; Period)
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs text-left">
                          <thead>
                            <tr className="bg-red-50 text-red-900 border-b border-red-200">
                              <th className="p-2 font-bold">Course 1</th>
                              <th className="p-2 font-bold">Course 2</th>
                              <th className="p-2 font-bold">Assigned Date &amp; Period</th>
                              <th className="p-2 font-bold text-center">Student Overlap</th>
                              <th className="p-2 font-bold text-center">Severity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {evalResult.hardConflicts.map((c, i) => (
                              <tr key={i} className="hover:bg-red-50/40">
                                <td className="p-2 font-bold text-slate-800">{c.courseA.course_code} - {c.courseA.course_title}</td>
                                <td className="p-2 font-bold text-slate-800">{c.courseB.course_code} - {c.courseB.course_title}</td>
                                <td className="p-2 font-semibold text-slate-600">{c.dateStr} (Period {c.period})</td>
                                <td className="p-2 text-center font-black text-red-700">{c.overlap} Students</td>
                                <td className="p-2 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white">
                                    {c.severity}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ORAL EXAM VIOLATIONS */}
                  {evalResult.oralViolations.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-purple-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                        <span>🎤</span> Oral Exam Period Violations (Assigned to Period 2)
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs text-left">
                          <thead>
                            <tr className="bg-purple-50 text-purple-900 border-b border-purple-200">
                              <th className="p-2 font-bold">Course Code &amp; Title</th>
                              <th className="p-2 font-bold">Program &amp; Level</th>
                              <th className="p-2 font-bold">Assigned Slot</th>
                              <th className="p-2 font-bold">Rule Requirement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {evalResult.oralViolations.map((v, i) => (
                              <tr key={i} className="hover:bg-purple-50/40">
                                <td className="p-2 font-bold text-slate-800">{v.course.course_code} - {v.course.course_title}</td>
                                <td className="p-2 text-slate-600">{v.course.program} (L{v.course.level})</td>
                                <td className="p-2 font-bold text-purple-800">{v.dateStr} — Period {v.period}</td>
                                <td className="p-2 text-slate-700 font-medium">{v.rule}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* CAPACITY VIOLATIONS */}
                  {evalResult.periodCapacityViolations.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-purple-200 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-purple-900 font-extrabold text-xs">
                        <span>👥</span> Period Capacity Overshoots (&gt; 1000 Students)
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs text-left">
                          <thead>
                            <tr className="bg-purple-50 text-purple-900 border-b border-purple-200">
                              <th className="p-2 font-bold">Date &amp; Period</th>
                              <th className="p-2 font-bold text-center">Total Students</th>
                              <th className="p-2 font-bold">Assigned Courses</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {evalResult.periodCapacityViolations.map((v, i) => (
                              <tr key={i}>
                                <td className="p-2 font-bold text-slate-800">{v.dateStr} (Period {v.period})</td>
                                <td className="p-2 text-center font-black text-purple-700">{v.totalStudents} / 1000</td>
                                <td className="p-2 text-slate-600 font-medium">{v.courses.join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: UNASSIGNED COURSES */}
              {activeTab === 'unassigned' && (
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                    <span>📋</span> Unassigned Courses from Step 3 Database ({evalResult.unassignedCourses.length})
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {evalResult.unassignedCourses.map(c => (
                      <span key={c.id} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px]">
                        {c.course_code} ({c.program} L{c.level})
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all"
          >
            Close
          </button>

          {evalResult && (
            <button
              onClick={() => onApplySchedule(evalResult.assignmentsMap)}
              className="py-2 px-5 rounded-xl bg-[#002147] hover:bg-[#001530] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <span>🚀</span> Load Evaluated Manual Timetable into Application
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default CsvScheduleEvaluator;

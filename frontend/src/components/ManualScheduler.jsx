import { useState, useEffect } from 'react';
import axios from 'axios';
import { addDays, format, parseISO } from 'date-fns';
import { getAbbreviatedCourseName } from '../utils/courseUtils';
import PdfExportModal from './PdfExportModal';
import CsvScheduleEvaluator from './CsvScheduleEvaluator';

function ManualScheduler({ sessionId, pdfSettings, onUpdatePdfSettings, onComplete, onBack, initialAssignments = {}, customCalendar = null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  
  const [calendar, setCalendar] = useState([]);
  const [programLevels, setProgramLevels] = useState([]);
  const [conflictMap, setConflictMap] = useState(new Map());
  
  // State for manual scheduling & drag-and-drop
  const [lockedAssignments, setLockedAssignments] = useState(initialAssignments); // course_id -> { dayIndex, period }
  
  // Sync if initialAssignments changes
  useEffect(() => {
    if (Object.keys(initialAssignments).length > 0) {
      setLockedAssignments(initialAssignments);
    }
  }, [initialAssignments]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [allowMinorConflicts, setAllowMinorConflicts] = useState(false); // false = inhibit ALL conflicts, true = allow <5 overlaps
  const [draggedCourse, setDraggedCourse] = useState(null);
  const [activeDragSlot, setActiveDragSlot] = useState(null);
  const [mobileTab, setMobileTab] = useState('grid'); // 'grid' or 'bank' on mobile phones
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showEvaluatorModal, setShowEvaluatorModal] = useState(false);
  const [showExceptionsSummaryModal, setShowExceptionsSummaryModal] = useState(false);

  // Course Bank Search, Filter & Sort State
  const [bankSearch, setBankSearch] = useState('');
  const [bankProgramFilter, setBankProgramFilter] = useState('ALL');
  const [bankLevelFilter, setBankLevelFilter] = useState('ALL');
  const [bankOralOnly, setBankOralOnly] = useState(false);
  const [bankSortBy, setBankSortBy] = useState('default'); // 'default', 'code', 'title', 'students_desc', 'students_asc'

  const getPdfScheduleData = () => {
    const scheduleItems = Object.entries(lockedAssignments).map(([courseId, assignment]) => {
      const course = courses.find(c => String(c.id) === String(courseId));
      const day = calendar[assignment.dayIndex];
      if (!course || !day) return null;
      return {
        course_id: course.id,
        course_code: course.course_code,
        course_title: course.course_title,
        program: course.program,
        level: course.level,
        student_count: course.student_count,
        has_oral_exam: course.has_oral_exam,
        course: course,
        exam_date: day.dateStr || day.date,
        period: assignment.period,
        day_of_week: day.dayOfWeek
      };
    }).filter(Boolean);

    return {
      session: session,
      schedule: scheduleItems
    };
  };

  useEffect(() => {
    fetchData();
  }, [sessionId]);

  const handleDragStart = (e, course, sourceInfo = { type: 'BANK' }) => {
    setDraggedCourse(course);
    const payload = JSON.stringify({ courseId: course.id, ...sourceInfo });
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverSlot = (e, dayIndex, period, programLevelKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slotKey = `${dayIndex}-${period}-${programLevelKey}`;
    if (activeDragSlot !== slotKey) {
      setActiveDragSlot(slotKey);
    }
  };

  const handleDragLeaveSlot = (e) => {
    e.preventDefault();
    setActiveDragSlot(null);
  };

  const handleDropOnSlot = (e, dayIndex, period, programLevelKey) => {
    e.preventDefault();
    setActiveDragSlot(null);
    setDraggedCourse(null);

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      const course = courses.find(c => String(c.id) === String(data.courseId));
      if (!course) return;

      const coursePLKey = `${course.program}|Level ${course.level}`;
      if (coursePLKey !== programLevelKey) {
        alert("You can only assign a course to its matching Program and Level column.");
        return;
      }

      // Same-day conflict check (allows multiple courses in same period if 0 student conflict)
      const { hasConflict, conflictDetails } = isCourseConflicting(course.id, dayIndex);
      if (hasConflict) {
        const conflictNames = conflictDetails.map(cd => {
          const c = courses.find(item => String(item.id) === String(cd.id));
          return `${c ? c.course_code : cd.id} (${cd.overlap} student overlap)`;
        }).join(', ');
        alert(`⚠️ Same-Day Conflict Warning!\n\n"${course.course_code}" has student overlap with course(s) assigned to this date:\n• ${conflictNames}`);
      }

      // Update assignment (moves course from bank or re-positions from another period/day)
      const targetDay = calendar[dayIndex];
      setLockedAssignments(prev => ({
        ...prev,
        [course.id]: { dayIndex, period, dateStr: targetDay?.dateStr }
      }));
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleDropOnBank = (e) => {
    e.preventDefault();
    setDraggedCourse(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.courseId) {
        setLockedAssignments(prev => {
          const next = { ...prev };
          delete next[data.courseId];
          return next;
        });
      }
    } catch (err) {}
  };

  const fetchData = async () => {
    try {
      const response = await axios.get(`/api/scheduler/data/${sessionId}`);
      if (response.data.success) {
        setSession(response.data.session);
        setCourses(response.data.courses);
        setConflicts(response.data.conflicts);
        
        // Build conflict map
        const map = new Map();
        response.data.conflicts.forEach(c => {
          const k1 = String(c.course_a_id);
          const k2 = String(c.course_b_id);
          if (!map.has(k1)) map.set(k1, new Map());
          if (!map.has(k2)) map.set(k2, new Map());
          map.get(k1).set(k2, c.overlap_count);
          map.get(k2).set(k1, c.overlap_count);
        });
        setConflictMap(map);

        // Build calendar (skipping Fridays and official vacation dates)
        let excludedList = [];
        try {
          const rawEx = response.data.session.excluded_dates;
          excludedList = typeof rawEx === 'string'
            ? JSON.parse(rawEx || '[]')
            : (Array.isArray(rawEx) ? rawEx : []);
        } catch (e) {}

        const excludedSet = new Set(excludedList.map(d => String(d).trim()));

        const cal = [];
        let currentDate = parseISO(response.data.session.start_date);
        const endDate = parseISO(response.data.session.end_date);
        let dayIndex = 0;
        let isGroupA = true;

        while (currentDate <= endDate) {
          const dayOfWeek = format(currentDate, 'EEEE');
          const dateStr = format(currentDate, 'yyyy-MM-dd');

          if (dayOfWeek !== 'Friday' && !excludedSet.has(dateStr)) {
            cal.push({
              dayIndex: dayIndex++,
              dateStr,
              dayOfWeek,
              groupType: isGroupA ? 'A' : 'B'
            });
            isGroupA = !isGroupA;
          }
          currentDate = addDays(currentDate, 1);
        }
        
        if (customCalendar) {
          setCalendar(customCalendar);
        } else {
          setCalendar(cal);
        }

        // Build program levels (sorted by Level first so same level across programs are consecutive)
        const plSet = new Set();
        response.data.courses.forEach(c => plSet.add(`${c.program}|Level ${c.level}`));
        const sortedPL = [...plSet].sort((a, b) => {
          const [progA, lvlStrA] = a.split('|Level ');
          const [progB, lvlStrB] = b.split('|Level ');
          const lvlA = Number(lvlStrA) || 0;
          const lvlB = Number(lvlStrB) || 0;
          if (lvlA !== lvlB) return lvlA - lvlB;
          return progA.localeCompare(progB);
        });
        setProgramLevels(sortedPL);
        
      } else {
        setError('Failed to fetch session data.');
      }
    } catch (err) {
      setError('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const getOverlap = (id1, id2) => {
    return conflictMap.get(String(id1))?.get(String(id2)) || 0;
  };

  const isCourseConflicting = (courseId, dayIndex) => {
    let hasConflict = false;
    let hasMinorException = false;
    let conflictDetails = [];
    let minorExceptionDetails = [];

    Object.entries(lockedAssignments).forEach(([assignedCourseId, assignment]) => {
      if (assignment.dayIndex === dayIndex && String(assignedCourseId) !== String(courseId)) {
        const overlap = getOverlap(courseId, assignedCourseId);
        
        if (overlap >= 5 || (!allowMinorConflicts && overlap > 0)) {
          hasConflict = true;
          conflictDetails.push({ id: assignedCourseId, overlap });
        } else if (allowMinorConflicts && overlap >= 1 && overlap < 5) {
          hasMinorException = true;
          minorExceptionDetails.push({ id: assignedCourseId, overlap });
        }
      }
    });

    return { hasConflict, hasMinorException, conflictDetails, minorExceptionDetails };
  };

  const getAllMinorExceptionsInSchedule = () => {
    const exceptions = [];
    const processedPairs = new Set();

    Object.entries(lockedAssignments).forEach(([cId1, a1]) => {
      Object.entries(lockedAssignments).forEach(([cId2, a2]) => {
        if (cId1 >= cId2) return;
        if (a1.dayIndex === a2.dayIndex) {
          const overlap = getOverlap(cId1, cId2);
          if (overlap >= 1 && overlap < 5) {
            const pairKey = `${cId1}_${cId2}`;
            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey);
              const course1 = courses.find(c => String(c.id) === String(cId1));
              const course2 = courses.find(c => String(c.id) === String(cId2));
              if (course1 && course2) {
                const day = calendar[a1.dayIndex];
                exceptions.push({
                  course1,
                  course2,
                  dateStr: day ? day.dateStr : `Day ${a1.dayIndex + 1}`,
                  overlap
                });
              }
            }
          }
        }
      });
    });

    return exceptions;
  };

  const handleCourseClick = (course) => {
    if (selectedCourse && selectedCourse.id === course.id) {
      setSelectedCourse(null); // deselect
    } else {
      setSelectedCourse(course);
    }
  };

  const handleSlotClick = (dayIndex, period, programLevelKey) => {
    if (!selectedCourse) return;
    
    const coursePLKey = `${selectedCourse.program}|Level ${selectedCourse.level}`;
    if (coursePLKey !== programLevelKey) {
      alert("You can only assign a course to its matching Program and Level column.");
      return;
    }

    // Same-day conflict check (allows multiple courses in same period if 0 student conflict)
    const { hasConflict, conflictDetails } = isCourseConflicting(selectedCourse.id, dayIndex);
    if (hasConflict) {
       const conflictNames = conflictDetails.map(cd => {
         const c = courses.find(item => String(item.id) === String(cd.id));
         return `${c ? c.course_code : cd.id} (${cd.overlap} student overlap)`;
       }).join(', ');
       alert(`⚠️ Same-Day Conflict Warning!\n\n"${selectedCourse.course_code}" has student overlap with course(s) assigned to this date:\n• ${conflictNames}\n\nThe assignment was saved, but please note the conflict highlight.`);
    }

    // Assign
    setLockedAssignments(prev => ({
      ...prev,
      [selectedCourse.id]: { dayIndex, period }
    }));
    setSelectedCourse(null);
  };

  const handleUnassign = (courseId, e) => {
    e.stopPropagation();
    setLockedAssignments(prev => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  };

  const handleAutoScheduleLevel = (targetLevel) => {
    const targetCourses = courses.filter(c => String(c.level) === String(targetLevel) && !lockedAssignments[c.id]);
    
    if (targetCourses.length === 0) {
      alert(`All Level ${targetLevel} courses are already scheduled!`);
      return;
    }

    const nextAssignments = { ...lockedAssignments };
    
    // Group courses by normalized title/code to identify cross-program same course names
    const courseGroups = [];
    const processedIds = new Set();

    targetCourses.forEach(c => {
      if (processedIds.has(c.id)) return;

      const normTitle = c.course_title.trim().toLowerCase();
      const normCode = c.course_code.trim().toLowerCase();

      // Find matching courses across other programs in the same level
      const matchingSameName = targetCourses.filter(other => 
        !processedIds.has(other.id) &&
        (other.course_title.trim().toLowerCase() === normTitle || other.course_code.trim().toLowerCase() === normCode)
      );

      matchingSameName.forEach(m => processedIds.add(m.id));
      courseGroups.push(matchingSameName);
    });

    // Sort course groups to improve greedy scheduling success:
    // 1. Oral exams first (since they MUST be in Period 1, they are harder to place).
    // 2. Larger student count first (harder to place without conflicts).
    courseGroups.sort((a, b) => {
      const aHasOral = a.some(c => c.has_oral_exam) ? 1 : 0;
      const bHasOral = b.some(c => c.has_oral_exam) ? 1 : 0;
      if (aHasOral !== bHasOral) {
        return bHasOral - aHasOral;
      }
      const aStudents = a.reduce((sum, c) => sum + (c.student_count || 0), 0);
      const bStudents = b.reduce((sum, c) => sum + (c.student_count || 0), 0);
      return bStudents - aStudents;
    });

    // Group A/B day preference (Odd levels 1,3,5 -> Group A, Even levels 2,4 -> Group B)
    const isOddLevel = Number(targetLevel) % 2 !== 0;
    const preferredGroup = isOddLevel ? 'A' : 'B';
    const primaryDays = calendar.filter(d => d.groupType === preferredGroup);
    const candidateDays = primaryDays.length > 0 ? primaryDays : calendar;
    const nonPreferredDays = calendar.filter(d => !candidateDays.includes(d));

    courseGroups.forEach(group => {
      let chosenDay = null;
      let chosenPeriod = 1;

      // Helper: count how many courses are already assigned to a given day
      const getDayOccupancy = (dayIndex) => {
        return Object.values(nextAssignments).filter(a => a.dayIndex === dayIndex).length;
      };

      // Sort candidate days: busiest first (compact schedule = more free rest days)
      const sortByOccupancy = (days) => {
        return [...days].sort((a, b) => getDayOccupancy(b.dayIndex) - getDayOccupancy(a.dayIndex));
      };

      // Helper function to validate and try placing a group on a specific day and period
      const isDayPeriodValid = (day, periodToTry) => {
        for (const course of group) {
          // Oral exams MUST be in Period 1
          if (periodToTry === 2 && course.has_oral_exam) return false;

          // Check if there is a direct student conflict in this specific period
          const periodConflict = Object.entries(nextAssignments).some(([cId, a]) => {
            if (a.dayIndex !== day.dayIndex || a.period !== periodToTry) return false;
            const overlap = getOverlap(course.id, cId);
            return allowMinorConflicts ? overlap >= 5 : overlap > 0;
          });
          if (periodConflict) return false;

          // Check global capacity for the period (1000 students max)
          const assignedCoursesInPeriod = Object.entries(nextAssignments)
            .filter(([_, a]) => a.dayIndex === day.dayIndex && a.period === periodToTry)
            .map(([cId]) => courses.find(item => String(item.id) === String(cId)))
            .filter(Boolean);
          const totalStudentsInPeriod = assignedCoursesInPeriod.reduce((sum, c) => sum + (c.student_count || 0), 0);
          if (totalStudentsInPeriod + (course.student_count || 0) > 1000) return false;

          // Same-day student conflict check (different period on same day)
          const dayAssignedIds = Object.entries(nextAssignments)
            .filter(([_, a]) => a.dayIndex === day.dayIndex)
            .map(([cId]) => cId);
          const hasConflictWithAssigned = dayAssignedIds.some(assignedId => {
            const overlap = getOverlap(course.id, assignedId);
            return allowMinorConflicts ? overlap >= 5 : overlap > 0;
          });
          if (hasConflictWithAssigned) return false;

          // Conflict check within the same group
          const hasConflictWithinGroup = group.some(otherInGroup => {
            if (otherInGroup.id === course.id) return false;
            const overlap = getOverlap(course.id, otherInGroup.id);
            return allowMinorConflicts ? overlap >= 5 : overlap > 0;
          });
          if (hasConflictWithinGroup) return false;
        }
        return true;
      };

      // Try placement: busiest days first (to compact schedule and create more rest days)
      const tryPlacement = (daysToSearch, periodToTry) => {
        const sorted = sortByOccupancy(daysToSearch);
        for (const day of sorted) {
          if (isDayPeriodValid(day, periodToTry)) {
            chosenDay = day;
            chosenPeriod = periodToTry;
            return true;
          }
        }
        return false;
      };

      // PASS 1: Preferred Days, Period 1 (busiest first)
      if (!chosenDay) tryPlacement(candidateDays, 1);
      // PASS 2: Preferred Days, Period 2 (busiest first)
      if (!chosenDay) tryPlacement(candidateDays, 2);
      // PASS 3: Non-Preferred Days, Period 1 (busiest first)
      if (!chosenDay) tryPlacement(nonPreferredDays, 1);
      // PASS 4: Non-Preferred Days, Period 2 (busiest first)
      if (!chosenDay) tryPlacement(nonPreferredDays, 2);



      if (chosenDay) {
        group.forEach(c => {
          nextAssignments[c.id] = { dayIndex: chosenDay.dayIndex, period: chosenPeriod, dateStr: chosenDay.dateStr };
        });
      }
    });

    setLockedAssignments(nextAssignments);
  };

  const handleAutoScheduleAll = () => {
    availableLevels.forEach(lvl => {
      handleAutoScheduleLevel(lvl);
    });
  };

  const handleClearLevel = (targetLevel) => {
    setLockedAssignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(cId => {
        const c = courses.find(item => String(item.id) === String(cId));
        if (c && String(c.level) === String(targetLevel)) {
          delete next[cId];
        }
      });
      return next;
    });
  };

  if (loading) {
    return (
      <div className="card w-full flex justify-center py-20">
        <svg className="animate-spin h-10 w-10 text-hue-navy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
    );
  }

  const unassignedCourses = courses.filter(c => !lockedAssignments[c.id]);
  const availableLevels = [...new Set(courses.map(c => c.level))].sort((a,b) => Number(a)-Number(b));

  return (
    <div className="card w-full flex flex-col h-[calc(100vh-48px)] p-3 sm:p-4">
      {/* Ultra-Compact Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-slate-200/80 shrink-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight font-outfit m-0">
            Manual Pre-Scheduling
          </h2>
          <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200">
            Optional
          </span>
          <span className="hidden md:inline text-xs text-slate-400 font-medium">| Pin courses manually or auto-schedule by level</span>
        </div>

        {/* Primary Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all shadow-2xs active:scale-95"
            onClick={onBack}
          >
            ← Back
          </button>
          
          <button 
            className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-900 font-extrabold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95" 
            onClick={() => setShowEvaluatorModal(true)}
            title="Export/Import manual CSV/Excel table and evaluate against Step 3 conflict data"
          >
            <span>📊</span> CSV / Excel Evaluator
          </button>

          <button 
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95" 
            onClick={() => setShowPdfModal(true)}
            title="Export official branded PDF timetable of current pre-scheduled courses"
          >
            <span>📄</span> Export PDF
          </button>

          <button 
            className="px-3.5 py-1.5 rounded-lg bg-[#002147] hover:bg-[#001530] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95 border border-[#FFB81C]/30" 
            onClick={() => onComplete(lockedAssignments, getPdfScheduleData())}
          >
            <span>🚀</span> Proceed to Generate ➔
          </button>
        </div>
      </div>

      {/* CSV / Excel Manual Timetable Evaluator Modal */}
      {showEvaluatorModal && (
        <CsvScheduleEvaluator
          sessionId={sessionId}
          courses={courses}
          conflicts={conflicts}
          calendar={calendar}
          onApplySchedule={(assignmentsMap) => {
            setLockedAssignments(assignmentsMap);
            setShowEvaluatorModal(false);
          }}
          onClose={() => setShowEvaluatorModal(false)}
        />
      )}

      {/* Branded PDF Export Modal */}
      {showPdfModal && (
        <PdfExportModal
          sessionId={sessionId}
          session={session}
          scheduleData={getPdfScheduleData()}
          externalPdfSettings={pdfSettings}
          onUpdatePdfSettings={onUpdatePdfSettings}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Ultra-Slim Quick Actions Toolbar */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-1.5 mb-2.5 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-0">
          {/* Conflict Policy Toggle */}
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2 shrink-0">
            <button
              onClick={() => setAllowMinorConflicts(!allowMinorConflicts)}
              className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg border transition-all flex items-center gap-1 active:scale-95 ${
                allowMinorConflicts 
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
              }`}
              title={allowMinorConflicts ? "Minor overlaps (<5 students) are allowed on same day" : "ALL student overlaps (≥1 student) are strictly blocked"}
            >
              {allowMinorConflicts ? '⚠️ Allow <5' : '🛡️ Inhibit ALL'}
            </button>

            {/* Bypassed Minor Conflicts Summary Badge */}
            {(() => {
              const activeExceptions = getAllMinorExceptionsInSchedule();
              if (activeExceptions.length === 0) return null;
              const totalExcludedStudents = activeExceptions.reduce((sum, item) => sum + item.overlap, 0);

              return (
                <button
                  onClick={() => setShowExceptionsSummaryModal(true)}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                  title="Click to view detailed breakdown of all minor student conflict overlaps allowed under exception policy"
                >
                  <span>⚠️ {activeExceptions.length} Ex</span>
                  <span className="bg-amber-950/40 text-amber-100 text-[9px] px-1 py-0.2 rounded-full font-bold">
                    ({totalExcludedStudents})
                  </span>
                </button>
              );
            })()}
          </div>

          <button
            onClick={handleAutoScheduleAll}
            className="px-2.5 py-1 rounded-lg bg-[#002147] hover:bg-[#001530] text-white text-[11px] font-extrabold shadow-2xs flex items-center gap-1 transition-all active:scale-95 shrink-0"
            title="Auto-place remaining unassigned courses across all levels"
          >
            <span>⚡</span> Auto-All
          </button>

          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            {availableLevels.map(lvl => {
              const levelUnassigned = courses.filter(c => String(c.level) === String(lvl) && !lockedAssignments[c.id]).length;
              return (
                <button
                  key={lvl}
                  onClick={() => handleAutoScheduleLevel(lvl)}
                  className="px-2 py-1 bg-white border border-slate-300 hover:border-[#002147] hover:bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1 active:scale-95"
                >
                  <span>L{lvl}</span>
                  {levelUnassigned > 0 ? (
                    <span className="bg-[#002147] text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full min-w-3.5 text-center">
                      {levelUnassigned}
                    </span>
                  ) : (
                    <span className="text-emerald-600 text-[10px] font-black">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button 
            onClick={() => setLockedAssignments({})}
            className="text-[11px] text-rose-600 hover:text-rose-700 font-bold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>🗑️</span> Clear
          </button>
        </div>
      </div>

      {/* Mobile View Selector Bar (< md) */}
      <div className="flex md:hidden bg-slate-200/80 p-1 rounded-xl mb-2 shrink-0 border border-slate-300/60">
        <button
          onClick={() => setMobileTab('grid')}
          className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'grid' ? 'bg-[#002147] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <span>📅</span> Timetable Grid
        </button>
        <button
          onClick={() => setMobileTab('bank')}
          className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'bank' ? 'bg-[#002147] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <span>📋</span> Course Bank ({unassignedCourses.length})
        </button>
      </div>

      <div className="flex gap-4 md:gap-6 flex-1 overflow-hidden min-h-0">
        {/* Course Bank Sidebar - Mobile Responsive */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnBank}
          className={`w-full md:w-64 shrink-0 bg-white rounded-xl shadow-2xs border border-slate-200 flex-col overflow-hidden ${
            mobileTab === 'bank' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Course Bank Header & Filter Bar */}
          <div className="p-2 border-b border-slate-200 bg-slate-50 shrink-0 space-y-1.5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-extrabold text-[#002147] uppercase tracking-wider">
                  Course Bank ({(() => {
                    const unassigned = courses.filter(c => !lockedAssignments[c.id]);
                    const filtered = unassigned.filter(c => {
                      if (bankSearch) {
                        const q = bankSearch.toLowerCase().trim();
                        const codeMatch = String(c.course_code || '').toLowerCase().includes(q);
                        const titleMatch = String(c.course_title || '').toLowerCase().includes(q);
                        const progMatch = String(c.program || '').toLowerCase().includes(q);
                        if (!codeMatch && !titleMatch && !progMatch) return false;
                      }
                      if (bankProgramFilter !== 'ALL' && c.program !== bankProgramFilter) return false;
                      if (bankLevelFilter !== 'ALL' && String(c.level) !== String(bankLevelFilter)) return false;
                      if (bankOralOnly && !c.has_oral_exam) return false;
                      return true;
                    });
                    return `${filtered.length}/${unassigned.length}`;
                  })()})
                </h3>
                <p className="text-[9.5px] text-slate-500 font-medium">Drag to grid or click to select</p>
              </div>

              {(bankSearch || bankProgramFilter !== 'ALL' || bankLevelFilter !== 'ALL' || bankOralOnly || bankSortBy !== 'default') && (
                <button
                  type="button"
                  onClick={() => {
                    setBankSearch('');
                    setBankProgramFilter('ALL');
                    setBankLevelFilter('ALL');
                    setBankOralOnly(false);
                    setBankSortBy('default');
                  }}
                  className="text-[9.5px] text-rose-600 font-bold hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="🔍 Search code, title..."
                className="w-full h-6.5 pl-2 pr-6 rounded-md border border-slate-300 bg-white text-[11px] font-medium focus:border-[#002147] focus:outline-none"
              />
              {bankSearch && (
                <button
                  onClick={() => setBankSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {/* Program Filter */}
              <select
                value={bankProgramFilter}
                onChange={(e) => setBankProgramFilter(e.target.value)}
                className="h-6.5 px-1 rounded border border-slate-300 bg-white font-bold text-slate-700 text-[10.5px]"
              >
                <option value="ALL">All Programs</option>
                {[...new Set(courses.map(c => c.program))].map(prog => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>

              {/* Level Filter */}
              <select
                value={bankLevelFilter}
                onChange={(e) => setBankLevelFilter(e.target.value)}
                className="h-6.5 px-1 rounded border border-slate-300 bg-white font-bold text-slate-700 text-[10.5px]"
              >
                <option value="ALL">All Levels</option>
                {availableLevels.map(lvl => (
                  <option key={lvl} value={lvl}>Level {lvl}</option>
                ))}
              </select>
            </div>

            {/* Sort & Oral Filter Row */}
            <div className="flex items-center justify-between gap-1 text-[10px]">
              <select
                value={bankSortBy}
                onChange={(e) => setBankSortBy(e.target.value)}
                className="h-6.5 px-1 rounded border border-slate-300 bg-white font-bold text-[#002147] text-[10.5px] flex-1"
              >
                <option value="default">Sort: Default (Program)</option>
                <option value="code">Sort: Code (A-Z)</option>
                <option value="title">Sort: Title (A-Z)</option>
                <option value="students_desc">Sort: Students (High → Low)</option>
                <option value="students_asc">Sort: Students (Low → High)</option>
              </select>

              <button
                type="button"
                onClick={() => setBankOralOnly(!bankOralOnly)}
                className={`h-6.5 px-1.5 rounded border text-[10px] font-bold transition-all shrink-0 ${
                  bankOralOnly ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
                title="Toggle Oral Exams Only"
              >
                🎤 Oral
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {(() => {
              const unassigned = courses.filter(c => !lockedAssignments[c.id]);

              const filtered = unassigned.filter(c => {
                if (bankSearch) {
                  const q = bankSearch.toLowerCase().trim();
                  const codeMatch = String(c.course_code || '').toLowerCase().includes(q);
                  const titleMatch = String(c.course_title || '').toLowerCase().includes(q);
                  const progMatch = String(c.program || '').toLowerCase().includes(q);
                  if (!codeMatch && !titleMatch && !progMatch) return false;
                }
                if (bankProgramFilter !== 'ALL' && c.program !== bankProgramFilter) return false;
                if (bankLevelFilter !== 'ALL' && String(c.level) !== String(bankLevelFilter)) return false;
                if (bankOralOnly && !c.has_oral_exam) return false;
                return true;
              });

              const sorted = [...filtered].sort((a, b) => {
                if (bankSortBy === 'code') return String(a.course_code || '').localeCompare(String(b.course_code || ''));
                if (bankSortBy === 'title') return String(a.course_title || '').localeCompare(String(b.course_title || ''));
                if (bankSortBy === 'students_desc') return (b.student_count || 0) - (a.student_count || 0);
                if (bankSortBy === 'students_asc') return (a.student_count || 0) - (b.student_count || 0);
                if (a.program !== b.program) return String(a.program).localeCompare(String(b.program));
                return Number(a.level || 0) - Number(b.level || 0);
              });

              const grouped = {};
              sorted.forEach(c => {
                const prog = String(c.program || 'Unknown Program').trim();
                const lvl = String(c.level || '1').trim();
                if (!grouped[prog]) grouped[prog] = {};
                if (!grouped[prog][lvl]) grouped[prog][lvl] = [];
                grouped[prog][lvl].push(c);
              });
              
              if (courses.length === 0) {
                return (
                  <div className="text-center p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 mt-4">
                    <p className="font-semibold text-xs mb-1">No courses uploaded for this session.</p>
                    <p className="text-[10px] text-red-500 mb-3">Please click below to return to Step 2.</p>
                    <button className="btn btn-secondary btn-sm w-full text-xs" onClick={onBack}>
                      Go to Step 2 (Upload)
                    </button>
                  </div>
                );
              }

              if (unassigned.length === 0) {
                return <div className="text-center text-slate-400 text-xs mt-6 font-semibold">🎉 All courses assigned to schedule!</div>;
              }

              if (sorted.length === 0) {
                return (
                  <div className="text-center text-slate-400 text-[11px] mt-6 p-3 border border-dashed rounded-lg">
                    🔍 No courses match criteria.
                  </div>
                );
              }

              const levelColors = {
                1: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', left: 'border-l-blue-500', selectedBg: 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' },
                2: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', left: 'border-l-emerald-500', selectedBg: 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]' },
                3: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', left: 'border-l-purple-500', selectedBg: 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.4)]' },
                4: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', left: 'border-l-amber-500', selectedBg: 'bg-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.4)]' },
                5: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', left: 'border-l-rose-500', selectedBg: 'bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.4)]' },
                'default': { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', left: 'border-l-slate-500', selectedBg: 'bg-slate-600 shadow-[0_0_15px_rgba(71,85,105,0.4)]' }
              };

              return Object.keys(grouped).sort().map(program => (
                <div key={program} className="mb-4">
                  <h4 className="text-[10.5px] font-extrabold uppercase tracking-wider mb-2 text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {program}
                  </h4>
                  {Object.keys(grouped[program]).sort((a,b) => Number(a)-Number(b)).map(level => {
                    const theme = levelColors[level] || levelColors['default'];
                    return (
                      <div key={level} className="mb-3 pl-2 border-l-2 border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <h5 className={`text-[10px] font-extrabold uppercase tracking-widest ${theme.text}`}>Level {level}</h5>
                          <button 
                            onClick={() => handleAutoScheduleLevel(level)}
                            className="text-[9px] font-extrabold text-[#002147] bg-slate-100 hover:bg-amber-100 px-1.5 py-0.2 rounded transition-colors"
                          >
                            ⚡ Auto-Place
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {grouped[program][level].map(course => {
                            const isSelected = selectedCourse?.id === course.id;
                            
                            return (
                              <div 
                                key={course.id}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, course, { type: 'BANK' })}
                                onClick={() => handleCourseClick(course)}
                                className={`p-2 rounded-r-md border-y border-r border-l-3 shadow-2xs cursor-grab active:cursor-grabbing transition-all duration-150 
                                  ${isSelected ? `text-white scale-[1.01] ${theme.selectedBg}` : `bg-white border-slate-200 text-slate-700 hover:bg-slate-50 ${theme.left}`}`}
                              >
                                <div className={`font-extrabold text-xs mb-0.5 ${isSelected ? 'text-white' : 'text-slate-800'}`}>{course.course_code}</div>
                                <div className={`text-[9.5px] font-medium leading-tight line-clamp-1 ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>{course.course_title}</div>
                                
                                <div className="flex gap-1.5 mt-1">
                                  <div className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    {course.student_count} Std
                                  </div>
                                  {course.has_oral_exam ? (
                                    <div className={`text-[8.5px] px-1 py-0.2 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                      🎤 Oral
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Matrix View - High Density Layout */}
        <div className={`flex-1 table-container overflow-auto bg-white rounded-xl shadow-2xs border border-slate-200 relative ${
          mobileTab === 'grid' ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        }`}>
          <table className="w-full text-xs">
            <thead className="table-header sticky top-0 z-20 shadow-2xs">
              <tr>
                <th className="sticky left-0 bg-slate-50 z-30 w-28 border-b border-r border-slate-200 p-1 text-[11px] font-extrabold text-slate-700">Date</th>
                {programLevels.map(pl => {
                  const [prog, lvl] = pl.split('|');
                  return (
                    <th key={pl} className="min-w-[160px] border-b border-slate-200 p-1 text-center bg-slate-50">
                      <div className="text-[#002147] font-black text-[11px]">{prog}</div>
                      <div className="text-slate-500 font-bold text-[10px]">{lvl}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calendar.map(day => (
                <tr key={day.dayIndex} className="table-row relative group">
                  <td className="table-cell sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] z-10 align-top p-1.5 border-r border-slate-200">
                    <div className="font-extrabold text-[#002147] text-xs leading-tight">{day.dateStr}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{day.dayOfWeek} (Gr {day.groupType})</div>
                  </td>
                  
                  {programLevels.map(pl => {
                    // Find assigned courses for this cell
                    const assignedHere = Object.entries(lockedAssignments)
                      .filter(([cId, a]) => {
                        const course = courses.find(c => String(c.id) === cId);
                        return a.dayIndex === day.dayIndex && `${course.program}|Level ${course.level}` === pl;
                      })
                      .map(([cId, a]) => ({ course: courses.find(c => String(c.id) === cId), period: a.period }));

                    const p1List = assignedHere.filter(x => x.period === 1);
                    const p2List = assignedHere.filter(x => x.period === 2);

                    const renderSlot = (periodNum, assignments) => {
                      const slotKey = `${day.dayIndex}-${periodNum}-${pl}`;
                      const isSlotHovered = activeDragSlot === slotKey;
                      const isSelectable = selectedCourse && `${selectedCourse.program}|Level ${selectedCourse.level}` === pl;

                      return (
                        <div 
                          onDragOver={(e) => handleDragOverSlot(e, day.dayIndex, periodNum, pl)}
                          onDragLeave={handleDragLeaveSlot}
                          onDrop={(e) => handleDropOnSlot(e, day.dayIndex, periodNum, pl)}
                          onClick={() => handleSlotClick(day.dayIndex, periodNum, pl)}
                          className={`p-1 rounded-md transition-all border min-h-[44px] flex flex-col justify-between ${
                            isSlotHovered 
                              ? 'bg-amber-100/80 border-amber-500 ring-2 ring-amber-300 shadow-md' 
                              : isSelectable 
                                ? 'bg-blue-50/70 border-blue-300 border-dashed cursor-pointer hover:bg-blue-100/80' 
                                : 'bg-slate-50/70 border-slate-200/80'
                          }`}
                        >
                          {/* Period Label Header */}
                          <div className="flex items-center justify-between gap-1 mb-0.5 pb-0.5 border-b border-slate-200/60 text-[8.5px] font-bold text-slate-500">
                            <span className={`px-1 py-0.1 rounded text-[8px] font-black ${
                              periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                            }`}>
                              P{periodNum}
                            </span>
                            <span className="text-[7.5px] font-medium text-slate-400">
                              {assignments.length > 0 ? `${assignments.length}` : 'Empty'}
                            </span>
                          </div>

                          {assignments.length > 0 ? (
                            <div className="space-y-1.5 flex-1">
                              {assignments.map(assignment => {
                                const { hasConflict, hasMinorException, conflictDetails, minorExceptionDetails } = isCourseConflicting(assignment.course.id, day.dayIndex);
                                const isSelected = selectedCourse?.id === assignment.course.id;

                                return (
                                  <div 
                                    key={assignment.course.id}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, assignment.course, { type: 'GRID', dayIndex: day.dayIndex, period: periodNum })}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCourseClick(assignment.course);
                                    }}
                                    className={`group/card p-1.5 rounded-md border relative cursor-grab active:cursor-grabbing transition-all ${
                                      isSelected ? 'ring-2 ring-hue-gold shadow-md' : ''
                                    } ${
                                      hasConflict 
                                        ? 'bg-red-50 border-red-300 shadow-sm' 
                                        : hasMinorException 
                                          ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-300 shadow-xs' 
                                          : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
                                    }`}
                                  >
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible transition-all duration-200 pointer-events-none">
                                      <div className={`p-2.5 rounded-xl text-xs shadow-2xl border ${
                                        hasConflict 
                                          ? 'bg-red-950 text-white border-red-500 shadow-red-950/50' 
                                          : hasMinorException
                                            ? 'bg-amber-950 text-white border-amber-500 shadow-amber-950/50'
                                            : isSelected 
                                              ? 'bg-[#002147] text-white border-hue-gold shadow-[#002147]/50'
                                              : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/50'
                                      }`}>
                                        <div className="font-bold flex items-center justify-between gap-1 mb-1">
                                          <span>
                                            {hasConflict 
                                              ? '🚨 Hard Student Conflict' 
                                              : hasMinorException 
                                                ? '⚠️ Minor Exception (<5 Overlaps)' 
                                                : isSelected 
                                                  ? '📌 Selected Course' 
                                                  : '✅ Conflict-Free'}
                                          </span>
                                          <span className="text-[10px] opacity-75 font-mono">{assignment.course.course_code}</span>
                                        </div>

                                        {hasConflict ? (
                                          <div className="space-y-1 text-[11px] leading-snug">
                                            <p className="text-red-200 font-medium">Overlaps with course(s) on {day.dateStr}:</p>
                                            <ul className="list-disc pl-3.5 text-red-100 space-y-0.5 font-medium">
                                              {conflictDetails.map(cd => {
                                                const c = courses.find(item => String(item.id) === String(cd.id));
                                                return (
                                                  <li key={cd.id}>
                                                    <span className="font-bold text-white">{c ? getAbbreviatedCourseName(c.course_title) : cd.id}</span> ({c ? c.program : ''}): <span className="underline decoration-red-400 font-bold">{cd.overlap} students</span>
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          </div>
                                        ) : hasMinorException ? (
                                          <div className="space-y-1 text-[11px] leading-snug">
                                            <p className="text-amber-200 font-bold">Placed under Minor Exception Policy (&lt;5 Students):</p>
                                            <ul className="list-disc pl-3.5 text-amber-100 space-y-0.5 font-medium">
                                              {minorExceptionDetails.map(cd => {
                                                const c = courses.find(item => String(item.id) === String(cd.id));
                                                return (
                                                  <li key={cd.id}>
                                                    <span className="font-bold text-white">{c ? getAbbreviatedCourseName(c.course_title) : cd.id}</span> ({c ? c.program : ''}): <span className="underline decoration-amber-400 font-bold">{cd.overlap} student overlap</span>
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          </div>
                                        ) : (
                                          <p className="text-slate-300 text-[11px] leading-relaxed">
                                            {isSelected 
                                              ? 'Course selected. Click any empty slot or drag to move.' 
                                              : 'Zero student overlaps detected on this exam date.'}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <button 
                                      onClick={(e) => handleUnassign(assignment.course.id, e)}
                                      className="absolute -top-1.5 -right-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center border shadow-xs text-[10px] z-10"
                                      title="Unassign course"
                                    >
                                      &times;
                                    </button>

                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className={`font-extrabold text-[11px] ${hasConflict ? 'text-red-700' : hasMinorException ? 'text-amber-900 font-black' : 'text-hue-navy'}`}>
                                        {assignment.course.course_code}
                                      </span>
                                      <span className="text-[8.5px] bg-slate-100 text-slate-700 font-bold px-1 py-0.2 rounded border border-slate-200 shrink-0">
                                        👥 {assignment.course.student_count || 0}
                                      </span>
                                    </div>
                                    <div className="text-[9.5px] text-slate-700 truncate font-semibold leading-tight">{assignment.course.course_title}</div>

                                    {hasMinorException && !hasConflict && (
                                      <div className="mt-1 flex items-center gap-1">
                                        <span className="text-[8px] bg-amber-200/90 text-amber-950 border border-amber-400/80 rounded px-1 font-black flex items-center gap-0.5">
                                          ⚠️ Exception: {minorExceptionDetails.reduce((sum, x) => sum + x.overlap, 0)} Overlap
                                        </span>
                                      </div>
                                    )}
                                    
                                    {assignment.course.has_oral_exam && (
                                      <div className="mt-1 text-[8px] bg-amber-100 text-amber-900 font-bold px-1 py-0.2 rounded border border-amber-300 inline-block">
                                        🎤 Oral Exam
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-2 flex items-center justify-center text-slate-300 text-[10px] font-medium">
                              {isSlotHovered ? `Drop to P${periodNum}` : isSelectable ? `+ Place in P${periodNum}` : `Period ${periodNum}`}
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <td key={pl} className="p-2 border-l border-slate-100 align-top">
                        <div className="flex flex-col gap-2">
                          {renderSlot(1, p1List)}
                          {renderSlot(2, p2List)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excluded Minor Conflicts Breakdown Modal */}
      {showExceptionsSummaryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h3 className="text-base font-extrabold text-amber-900 font-outfit">
                  Allowed Minor Conflicts Breakdown (&lt;5 Policy)
                </h3>
              </div>
              <button 
                onClick={() => setShowExceptionsSummaryModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Below is the list of all minor student conflict overlaps (<strong className="text-amber-900">&lt;5 students</strong>) allowed on the same exam date under your current Exception Policy:
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {getAllMinorExceptionsInSchedule().map((ex, idx) => (
                <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">
                      {ex.course1.course_code} ({ex.course1.program}) &amp; {ex.course2.course_code} ({ex.course2.program})
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">Exam Date: {ex.dateStr}</div>
                  </div>

                  <div className="px-2.5 py-1 bg-amber-500 text-white rounded-lg font-black text-xs shrink-0 shadow-2xs">
                    {ex.overlap} Student{ex.overlap > 1 ? 's' : ''} Bypassed
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowExceptionsSummaryModal(false)}
                className="btn btn-primary text-xs px-5 font-bold"
              >
                Close Breakdown
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default ManualScheduler;

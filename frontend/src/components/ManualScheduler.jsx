import { useState, useEffect } from 'react';
import axios from 'axios';
import { addDays, format, parseISO } from 'date-fns';
import { getAbbreviatedCourseName } from '../utils/courseUtils';
import PdfExportModal from './PdfExportModal';

function ManualScheduler({ sessionId, pdfSettings, onUpdatePdfSettings, onComplete, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  
  const [calendar, setCalendar] = useState([]);
  const [programLevels, setProgramLevels] = useState([]);
  const [conflictMap, setConflictMap] = useState(new Map());
  
  // State for manual scheduling & drag-and-drop
  const [lockedAssignments, setLockedAssignments] = useState({}); // course_id -> { dayIndex, period }
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [allowMinorConflicts, setAllowMinorConflicts] = useState(false); // false = inhibit ALL conflicts, true = allow <5 overlaps
  const [draggedCourse, setDraggedCourse] = useState(null);
  const [activeDragSlot, setActiveDragSlot] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

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
        setCalendar(cal);

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
    let conflictDetails = [];
    Object.entries(lockedAssignments).forEach(([assignedCourseId, assignment]) => {
      if (assignment.dayIndex === dayIndex && String(assignedCourseId) !== String(courseId)) {
        const overlap = getOverlap(courseId, assignedCourseId);
        const isConflict = allowMinorConflicts ? overlap >= 5 : overlap > 0;
        if (isConflict) {
          hasConflict = true;
          conflictDetails.push({ id: assignedCourseId, overlap });
        }
      }
    });
    return { hasConflict, conflictDetails };
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

      // Helper function to try placing a group in a specific set of days and a specific period
      const tryPlacement = (daysToSearch, periodToTry) => {
        for (const day of daysToSearch) {
          let isDayValid = true;

          for (const course of group) {
            // Oral exams MUST be in Period 1
            if (periodToTry === 2 && course.has_oral_exam) {
              isDayValid = false;
              break;
            }

            const plKey = `${course.program}|Level ${course.level}`;

            // Check if the period in this level column is already occupied
            // Check if there is a direct student conflict in this period
            const periodConflictInColumn = Object.entries(nextAssignments).some(([cId, a]) => {
              if (a.dayIndex !== day.dayIndex || a.period !== periodToTry) return false;
              const overlap = getOverlap(course.id, cId);
              return allowMinorConflicts ? overlap >= 5 : overlap > 0;
            });

            if (periodConflictInColumn) {
              isDayValid = false;
              break;
            }

            // Check global capacity for the period (1000 students max)
            const assignedCoursesInPeriod = Object.entries(nextAssignments)
              .filter(([_, a]) => a.dayIndex === day.dayIndex && a.period === periodToTry)
              .map(([cId]) => courses.find(item => String(item.id) === String(cId)))
              .filter(Boolean);
            const totalStudentsInPeriod = assignedCoursesInPeriod.reduce((sum, c) => sum + (c.student_count || 0), 0);
            const courseStudents = course.student_count || 0;
            
            if (totalStudentsInPeriod + courseStudents > 1000) {
              isDayValid = false;
              break;
            }

            // Same-day student conflict check against all courses assigned to this day
            const dayAssignedIds = Object.entries(nextAssignments)
              .filter(([_, a]) => a.dayIndex === day.dayIndex)
              .map(([cId]) => cId);

            const hasConflictWithAssigned = dayAssignedIds.some(assignedId => {
              const overlap = getOverlap(course.id, assignedId);
              return allowMinorConflicts ? overlap >= 5 : overlap > 0;
            });

            // Conflict check within the same group
            const hasConflictWithinGroup = group.some(otherInGroup => {
              if (otherInGroup.id === course.id) return false;
              const overlap = getOverlap(course.id, otherInGroup.id);
              return allowMinorConflicts ? overlap >= 5 : overlap > 0;
            });

            if (hasConflictWithAssigned || hasConflictWithinGroup) {
              isDayValid = false;
              break;
            }
          }

          if (isDayValid) {
            chosenDay = day;
            chosenPeriod = periodToTry;
            return true; // Found a valid placement
          }
        }
        return false; // Could not place in these days/period
      };

      // PASS 1: Preferred Days, Period 1
      if (!chosenDay) tryPlacement(candidateDays, 1);
      // PASS 2: Preferred Days, Period 2
      if (!chosenDay) tryPlacement(candidateDays, 2);
      // PASS 3: Non-Preferred Days, Period 1
      if (!chosenDay) tryPlacement(nonPreferredDays, 1);
      // PASS 4: Non-Preferred Days, Period 2
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
    <div className="card w-full flex flex-col h-[calc(100vh-120px)]">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h2 className="mb-1">Manual Pre-Scheduling & Level Assistant <span className="text-slate-400 font-normal text-lg">(Optional)</span></h2>
          <p className="text-sm text-slate-500">Pin courses manually or auto-schedule level by level. Cross-program same courses are automatically placed on the same day.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button 
            className="btn btn-gold font-bold shadow-md hover:shadow-lg flex items-center gap-1.5 text-xs" 
            onClick={() => setShowPdfModal(true)}
            title="Export official branded PDF timetable of current pre-scheduled courses"
          >
            📄 Export Branded PDF
          </button>
          <button className="btn btn-primary shadow-glow-primary" onClick={() => onComplete(lockedAssignments, getPdfScheduleData())}>
            Proceed to Generate
          </button>
        </div>
      </div>

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

      {/* Level Quick Actions Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Conflict Policy Toggle */}
          <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Conflict Rule:</span>
            <button
              onClick={() => setAllowMinorConflicts(!allowMinorConflicts)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border shadow-sm transition-all flex items-center gap-1.5 ${
                allowMinorConflicts 
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
              title={allowMinorConflicts ? "Minor overlaps (<5 students) are allowed on same day" : "ALL student overlaps (≥1 student) are strictly blocked"}
            >
              {allowMinorConflicts ? '⚠️ Allow <5 Overlaps' : '🛡️ Inhibit ALL Conflicts'}
            </button>
          </div>

          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">⚡ Auto-Schedule:</span>
          <button
            onClick={handleAutoScheduleAll}
            className="btn btn-primary btn-sm px-3 text-xs font-bold shadow-glow-primary flex items-center gap-1.5"
            title="Auto-place remaining unassigned courses across all levels"
          >
            ⚡ Auto-Schedule All
          </button>

          {availableLevels.map(lvl => {
            const levelUnassigned = courses.filter(c => String(c.level) === String(lvl) && !lockedAssignments[c.id]).length;
            return (
              <button
                key={lvl}
                onClick={() => handleAutoScheduleLevel(lvl)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-hue-gold hover:bg-hue-gold/10 text-slate-800 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>Level {lvl}</span>
                {levelUnassigned > 0 ? (
                  <span className="bg-hue-navy text-white text-[10px] px-1.5 py-0.2 rounded-full">{levelUnassigned}</span>
                ) : (
                  <span className="text-emerald-600 text-[10px]">✓</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setLockedAssignments({})}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
          >
            Clear All Pre-Scheduled
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden min-h-0">
        {/* Course Bank Sidebar */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnBank}
          className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Course Bank Header & Filter Bar */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0 space-y-2">
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
                <p className="text-[10px] text-slate-500 font-medium">Drag to grid or click to select</p>
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
                  className="text-[10px] text-rose-600 font-bold hover:underline"
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
                className="w-full h-7 pl-2.5 pr-6 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:border-hue-navy focus:outline-none"
              />
              {bankSearch && (
                <button
                  onClick={() => setBankSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
              {/* Program Filter */}
              <select
                value={bankProgramFilter}
                onChange={(e) => setBankProgramFilter(e.target.value)}
                className="h-7 px-1.5 rounded-md border border-slate-300 bg-white font-semibold text-slate-700 text-[11px]"
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
                className="h-7 px-1.5 rounded-md border border-slate-300 bg-white font-semibold text-slate-700 text-[11px]"
              >
                <option value="ALL">All Levels</option>
                {availableLevels.map(lvl => (
                  <option key={lvl} value={lvl}>Level {lvl}</option>
                ))}
              </select>
            </div>

            {/* Sort & Oral Filter Row */}
            <div className="flex items-center justify-between gap-1 text-[10.5px]">
              <select
                value={bankSortBy}
                onChange={(e) => setBankSortBy(e.target.value)}
                className="h-7 px-1.5 rounded-md border border-slate-300 bg-white font-bold text-[#002147] text-[11px] flex-1"
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
                className={`h-7 px-2 rounded-md border text-[10.5px] font-bold transition-all shrink-0 ${
                  bankOralOnly ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
                title="Toggle Oral Exams Only"
              >
                🎤 Oral
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                  <div className="text-center p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 mt-6">
                    <p className="font-semibold text-sm mb-2">No courses uploaded for this session.</p>
                    <p className="text-xs text-red-500 mb-4">Please click below to return to Step 2 and upload your CSV files.</p>
                    <button className="btn btn-secondary btn-sm w-full" onClick={onBack}>
                      Go to Step 2 (Upload)
                    </button>
                  </div>
                );
              }

              if (unassigned.length === 0) {
                return <div className="text-center text-slate-400 text-sm mt-10 font-medium">🎉 All courses assigned to schedule!</div>;
              }

              if (sorted.length === 0) {
                return (
                  <div className="text-center text-slate-400 text-xs mt-10 p-4 border border-dashed rounded-xl">
                    🔍 No courses match your search or filter criteria.
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
                <div key={program} className="mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-800 bg-slate-100 px-2 py-1 rounded">
                    {program}
                  </h4>
                  {Object.keys(grouped[program]).sort((a,b) => Number(a)-Number(b)).map(level => {
                    const theme = levelColors[level] || levelColors['default'];
                    return (
                      <div key={level} className="mb-5 pl-3 border-l-2 border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className={`text-[11px] font-bold uppercase tracking-widest ${theme.text}`}>Level {level}</h5>
                          <button 
                            onClick={() => handleAutoScheduleLevel(level)}
                            className="text-[10px] font-bold text-hue-navy bg-slate-100 hover:bg-hue-gold/20 px-2 py-0.5 rounded transition-colors"
                          >
                            ⚡ Auto-Place
                          </button>
                        </div>
                        <div className="space-y-2">
                          {grouped[program][level].map(course => {
                            const isSelected = selectedCourse?.id === course.id;
                            
                            return (
                              <div 
                                key={course.id}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, course, { type: 'BANK' })}
                                onClick={() => handleCourseClick(course)}
                                className={`p-3 rounded-r-lg border-y border-r border-l-4 shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200 
                                  ${isSelected ? `text-white scale-[1.02] ${theme.selectedBg}` : `bg-white border-slate-200 text-slate-700 hover:bg-slate-50 ${theme.left}`}`}
                              >
                                <div className={`font-bold text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-800'}`}>{course.course_code}</div>
                                <div className={`text-[10px] font-medium leading-snug ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>{course.course_title}</div>
                                
                                <div className="flex gap-2 mt-2">
                                  <div className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {course.student_count} Students
                                  </div>
                                  {course.has_oral_exam ? (
                                    <div className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
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

        {/* Matrix View */}
        <div className="flex-1 table-container overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 relative">
          <table className="w-full text-sm">
            <thead className="table-header sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="sticky left-0 bg-slate-50 z-30 w-32 border-b border-r border-slate-200">Date</th>
                {programLevels.map(pl => {
                  const [prog, lvl] = pl.split('|');
                  return (
                    <th key={pl} className="min-w-[200px] border-b border-slate-200">
                      <div className="text-hue-navy">{prog}</div>
                      <div className="text-slate-400 font-normal">{lvl}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calendar.map(day => (
                <tr key={day.dayIndex} className="table-row relative group">
                  <td className="table-cell sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] z-10 align-top pt-4">
                    <div className="font-bold text-hue-navy">{day.dateStr}</div>
                    <div className="text-xs text-slate-500">{day.dayOfWeek} (Gr {day.groupType})</div>
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
                          className={`p-1.5 rounded-lg transition-all border min-h-[60px] flex flex-col justify-between ${
                            isSlotHovered 
                              ? 'bg-amber-100/80 border-amber-500 ring-2 ring-amber-300 shadow-md' 
                              : isSelectable 
                                ? 'bg-blue-50/70 border-blue-300 border-dashed cursor-pointer hover:bg-blue-100/80' 
                                : 'bg-slate-50/70 border-slate-200/80'
                          }`}
                        >
                          {/* Period Label Header */}
                          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-slate-200/60 text-[9px] font-bold text-slate-500">
                            <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-extrabold ${
                              periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                            }`}>
                              P{periodNum}
                            </span>
                            <span className="text-[8px] font-medium text-slate-400">
                              {assignments.length > 0 ? `${assignments.length} course${assignments.length > 1 ? 's' : ''}` : 'Empty'}
                            </span>
                          </div>

                          {assignments.length > 0 ? (
                            <div className="space-y-1.5 flex-1">
                              {assignments.map(assignment => {
                                const { hasConflict, conflictDetails } = isCourseConflicting(assignment.course.id, day.dayIndex);
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
                                      hasConflict ? 'bg-red-50 border-red-300 shadow-sm' : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
                                    }`}
                                  >
                                    {/* Hover Tooltip */}
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 opacity-0 invisible group-hover/card:opacity-100 group-hover/card:visible transition-all duration-200 pointer-events-none">
                                      <div className={`p-2.5 rounded-xl text-xs shadow-2xl border ${
                                        hasConflict 
                                          ? 'bg-red-950 text-white border-red-500 shadow-red-950/50' 
                                          : isSelected 
                                            ? 'bg-amber-950 text-white border-amber-500 shadow-amber-950/50'
                                            : 'bg-slate-900 text-white border-slate-700 shadow-slate-900/50'
                                      }`}>
                                        <div className="font-bold flex items-center justify-between gap-1 mb-1">
                                          <span>{hasConflict ? '⚠️ Student Conflict' : isSelected ? '📌 Selected Course' : '✅ Conflict-Free'}</span>
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
                                      <span className={`font-extrabold text-[11px] ${hasConflict ? 'text-red-700' : 'text-hue-navy'}`}>{assignment.course.course_code}</span>
                                      <span className="text-[8.5px] bg-slate-100 text-slate-700 font-bold px-1 py-0.2 rounded border border-slate-200 shrink-0">
                                        👥 {assignment.course.student_count || 0}
                                      </span>
                                    </div>
                                    <div className="text-[9.5px] text-slate-700 truncate font-semibold leading-tight">{assignment.course.course_title}</div>
                                    
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
    </div>
  );
}

export default ManualScheduler;

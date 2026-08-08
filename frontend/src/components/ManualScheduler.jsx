import { useState, useEffect } from 'react';
import axios from 'axios';
import { addDays, format, parseISO } from 'date-fns';
import { getAbbreviatedCourseName } from '../utils/courseUtils';

function ManualScheduler({ sessionId, onComplete, onBack }) {
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

      // Check if target slot is occupied by ANOTHER course in the SAME program-level column
      const occupied = Object.entries(lockedAssignments).find(([cId, a]) => {
        if (String(cId) === String(course.id)) return false;
        const assignedCourse = courses.find(item => String(item.id) === String(cId));
        if (!assignedCourse) return false;
        const assignedPLKey = `${assignedCourse.program}|Level ${assignedCourse.level}`;
        return a.dayIndex === dayIndex && a.period === period && assignedPLKey === programLevelKey;
      });

      if (occupied) {
        alert("This period slot is already occupied by another course in this column. Unassign the existing course first.");
        return;
      }

      // Same-day conflict check
      const { hasConflict, conflictDetails } = isCourseConflicting(course.id, dayIndex);
      if (hasConflict) {
        const conflictNames = conflictDetails.map(cd => {
          const c = courses.find(item => String(item.id) === String(cd.id));
          return `${c ? c.course_code : cd.id} (${cd.overlap} student overlap)`;
        }).join(', ');
        alert(`⚠️ Same-Day Conflict Warning!\n\n"${course.course_code}" has student overlap with course(s) assigned to this date:\n• ${conflictNames}`);
      }

      // Update assignment (moves course from bank or re-positions from another period/day)
      setLockedAssignments(prev => ({
        ...prev,
        [course.id]: { dayIndex, period }
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

        // Build calendar
        const cal = [];
        let currentDate = parseISO(response.data.session.start_date);
        const endDate = parseISO(response.data.session.end_date);
        let dayIndex = 0;
        let isGroupA = true;

        while (currentDate <= endDate) {
          const dayOfWeek = format(currentDate, 'EEEE');
          if (dayOfWeek !== 'Friday') {
            cal.push({
              dayIndex: dayIndex++,
              dateStr: format(currentDate, 'yyyy-MM-dd'),
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

    // Check if slot is already occupied by another course in the SAME program-level column
    const occupied = Object.entries(lockedAssignments).find(([cId, a]) => {
      if (String(cId) === String(selectedCourse.id)) return false;
      const assignedCourse = courses.find(item => String(item.id) === String(cId));
      if (!assignedCourse) return false;
      const assignedPLKey = `${assignedCourse.program}|Level ${assignedCourse.level}`;
      return a.dayIndex === dayIndex && a.period === period && assignedPLKey === programLevelKey;
    });
    if (occupied) {
       alert("This period slot is already occupied by another course in this column. Unassign the existing course first.");
       return;
    }

    // Check for same-day conflict alerting
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

    // Group A/B day preference (Odd levels 1,3,5 -> Group A, Even levels 2,4 -> Group B)
    const isOddLevel = Number(targetLevel) % 2 !== 0;
    const preferredGroup = isOddLevel ? 'A' : 'B';
    const primaryDays = calendar.filter(d => d.groupType === preferredGroup);
    const candidateDays = primaryDays.length > 0 ? primaryDays : calendar;

    courseGroups.forEach(group => {
      let chosenDay = null;

      // Search candidate days for a valid day where ALL courses in group can be placed on the SAME DAY
      const searchDays = [...candidateDays, ...calendar.filter(d => !candidateDays.includes(d))];

      for (const day of searchDays) {
        let isDayValid = true;

        for (const course of group) {
          // 1. Conflict check against existing assignments on this day
          const dayAssignedIds = Object.entries(nextAssignments)
            .filter(([_, a]) => a.dayIndex === day.dayIndex)
            .map(([cId]) => cId);

          const hasConflictWithAssigned = dayAssignedIds.some(assignedId => {
            const overlap = getOverlap(course.id, assignedId);
            return allowMinorConflicts ? overlap >= 5 : overlap > 0;
          });

          // 2. Conflict check within the same group being placed together
          const hasConflictWithinGroup = group.some(otherInGroup => {
            if (otherInGroup.id === course.id) return false;
            const overlap = getOverlap(course.id, otherInGroup.id);
            return allowMinorConflicts ? overlap >= 5 : overlap > 0;
          });

          // 3. Strict 1-Exam-Per-Level-Per-Day rule (A level column can only have 1 exam per day)
          const plKey = `${course.program}|Level ${course.level}`;
          const columnAlreadyHasExam = Object.entries(nextAssignments).some(([cId, a]) => {
            const c = courses.find(item => String(item.id) === String(cId));
            return c && a.dayIndex === day.dayIndex && `${c.program}|Level ${c.level}` === plKey;
          });

          if (hasConflictWithAssigned || hasConflictWithinGroup || columnAlreadyHasExam) {
            isDayValid = false;
            break;
          }
        }

        if (isDayValid) {
          chosenDay = day;
          break;
        }
      }

      if (chosenDay) {
        // Place all courses in group on the chosenDay (same day for cross-program duplicates)
        group.forEach(course => {
          const plKey = `${course.program}|Level ${course.level}`;
          let period = 1;

          const p1Occupied = Object.entries(nextAssignments).some(([cId, a]) => {
            const c = courses.find(item => String(item.id) === String(cId));
            return c && a.dayIndex === chosenDay.dayIndex && a.period === 1 && `${c.program}|Level ${c.level}` === plKey;
          });

          if (p1Occupied && !course.has_oral_exam) {
            period = 2;
          }

          nextAssignments[course.id] = { dayIndex: chosenDay.dayIndex, period };
        });
      }
    });

    setLockedAssignments(nextAssignments);
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
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button className="btn btn-primary shadow-glow-primary" onClick={() => onComplete(lockedAssignments)}>
            Proceed to Generate
          </button>
        </div>
      </div>

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

          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">⚡ Auto-Schedule Level:</span>
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
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Course Bank ({unassignedCourses.length})</h3>
            <p className="text-[10px] text-slate-400 mt-1">Drag course to matrix, or click to place.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {(() => {
              const grouped = {};
              unassignedCourses.forEach(c => {
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

              if (Object.keys(grouped).length === 0) {
                return <div className="text-center text-slate-400 text-sm mt-10">All courses assigned!</div>;
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

                    const p1 = assignedHere.find(x => x.period === 1);
                    const p2 = assignedHere.find(x => x.period === 2);

                    const renderSlot = (periodNum, assignment) => {
                      const slotKey = `${day.dayIndex}-${periodNum}-${pl}`;
                      const isSlotHovered = activeDragSlot === slotKey;

                      if (assignment) {
                        const { hasConflict, conflictDetails } = isCourseConflicting(assignment.course.id, day.dayIndex);
                        const isSelected = selectedCourse?.id === assignment.course.id;

                        return (
                          <div 
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, assignment.course, { type: 'GRID', dayIndex: day.dayIndex, period: periodNum })}
                            onClick={() => handleCourseClick(assignment.course)}
                            className={`group/card p-2 rounded border relative cursor-grab active:cursor-grabbing transition-all ${isSelected ? 'ring-2 ring-hue-gold' : ''} ${hasConflict ? 'bg-red-50 border-red-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-slate-50 border-slate-200'}`}
                          >
                            {/* Hover Reason Bubble / Tooltip */}
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

                                {/* Arrow */}
                                <div className={`absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent ${
                                  hasConflict ? 'border-t-red-950' : isSelected ? 'border-t-amber-950' : 'border-t-slate-900'
                                }`} />
                              </div>
                            </div>

                            <button 
                              onClick={(e) => handleUnassign(assignment.course.id, e)}
                              className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full w-5 h-5 flex items-center justify-center border shadow-sm z-10"
                            >
                              &times;
                            </button>
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`badge ${hasConflict ? 'badge-danger' : 'badge-gray'} text-[9px] px-1 py-0`}>P{periodNum}</span>
                              <span className={`font-bold text-xs ${hasConflict ? 'text-red-700' : 'text-hue-navy'}`}>{assignment.course.course_code}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mb-1.5">{assignment.course.course_title}</div>
                            
                            <div className="flex items-center justify-between gap-1 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold text-slate-600">
                              <span>👥 {assignment.course.student_count || 0} Students</span>
                              {assignment.course.has_oral_exam && <span className="text-amber-700 font-bold">🎤</span>}
                            </div>
                          </div>
                        );
                      } else {
                        const isSelectable = selectedCourse && `${selectedCourse.program}|Level ${selectedCourse.level}` === pl;
                        return (
                          <div 
                            onClick={() => handleSlotClick(day.dayIndex, periodNum, pl)}
                            onDragOver={(e) => handleDragOverSlot(e, day.dayIndex, periodNum, pl)}
                            onDragLeave={handleDragLeaveSlot}
                            onDrop={(e) => handleDropOnSlot(e, day.dayIndex, periodNum, pl)}
                            className={`h-12 rounded border border-dashed flex items-center justify-center text-[10px] transition-all
                              ${isSlotHovered ? 'border-hue-gold bg-hue-gold/20 text-hue-navy font-bold scale-[1.03] shadow-md' : isSelectable ? 'border-hue-gold/50 bg-hue-gold/5 text-hue-gold hover:bg-hue-gold/20 cursor-pointer' : 'border-slate-200 bg-slate-50/50 text-slate-300'}`}
                          >
                            {isSlotHovered ? `Drop P${periodNum}` : isSelectable ? `Place in P${periodNum}` : `Period ${periodNum}`}
                          </div>
                        );
                      }
                    };

                    return (
                      <td key={pl} className="p-2 border-l border-slate-100 align-top">
                        <div className="flex flex-col gap-2">
                          {renderSlot(1, p1)}
                          {renderSlot(2, p2)}
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

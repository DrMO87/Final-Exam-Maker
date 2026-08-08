import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import ScheduleVaultModal from './ScheduleVaultModal';

function ScheduleViewer({ sessionId, schedule, lockedAssignments, onScheduleGenerated, onBack, onReset }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState(schedule);
  const [showVaultModal, setShowVaultModal] = useState(false);

  const lockedCount = Object.keys(lockedAssignments || {}).length;
  const [showChoiceModal, setShowChoiceModal] = useState(!schedule && lockedCount > 0);

  useEffect(() => {
    // If no schedule exists yet and no locked assignments, auto-generate directly
    if (!generatedSchedule && lockedCount === 0) {
      handleGenerateSchedule(true);
    }
  }, []);

  const handleGenerateSchedule = async (ignoreStep3 = false) => {
    setLoading(true);
    setError('');
    setShowChoiceModal(false);

    try {
      const activeLocks = (ignoreStep3 === true) ? {} : (lockedAssignments || {});
      const response = await axios.post(`/api/scheduler/generate/${sessionId}`, {
        lockedAssignments: activeLocks
      });

      if (response.data.success) {
        setGeneratedSchedule(response.data);
        onScheduleGenerated(response.data);
      } else {
        setError('Failed to generate schedule');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while generating schedule');
    } finally {
      setLoading(false);
    }
  };

  const exportToMarkdown = () => {
    if (!generatedSchedule || !generatedSchedule.schedule) return;

    let markdown = '# PharmD Final Exam Schedule\n\n';
    markdown += '| Date | Period | Day of Week | Program | Level | Course Code | Course Title | Has Oral Exam |\n';
    markdown += '|------|--------|-------------|---------|-------|-------------|--------------|---------------|\n';

    generatedSchedule.schedule.sort((a, b) => a.exam_date.localeCompare(b.exam_date) || a.period - b.period).forEach(item => {
      const course = item.course;
      const oralStatus = course.has_oral_exam ? 'Yes' : 'No';
      const courseTitle = `${course.course_title} (${oralStatus}, ~${course.student_count} students)`;
      
      markdown += `| ${item.exam_date} | Period ${item.period} | ${item.day_of_week} | ${course.program} | ${course.level} | ${course.course_code} | ${courseTitle} | ${oralStatus} |\n`;
    });

    if (generatedSchedule.violations && generatedSchedule.violations.length > 0) {
      markdown += '\n## Violations and Warnings\n\n';
      generatedSchedule.violations.forEach(v => {
        markdown += `- **${v.type}**: ${v.course} (${v.program}, Level ${v.level})\n`;
      });
    }

    // Download the markdown file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-schedule-${sessionId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const groupScheduleByDateAndPeriod = () => {
    if (!generatedSchedule || !generatedSchedule.schedule) return {};

    const grouped = {};
    generatedSchedule.schedule.forEach(item => {
      const key = `${item.exam_date}|${item.period}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: item.exam_date,
          period: item.period,
          dayOfWeek: item.day_of_week,
          groupType: item.group_type,
          exams: []
        };
      }
      grouped[key].exams.push(item);
    });

    return grouped;
  };

  // Create matrix view: rows = dates, columns = program-level combinations
  const createMatrixView = () => {
    if (!generatedSchedule || !generatedSchedule.schedule) return { dates: [], programLevels: [], matrix: {} };

    // Get all unique dates (sorted)
    const dates = [...new Set(generatedSchedule.schedule.map(item => item.exam_date))].sort();

    // Get all unique program-level combinations (sorted)
    const programLevelSet = new Set();
    generatedSchedule.schedule.forEach(item => {
      const key = `${item.course.program}|Level ${item.course.level}`;
      programLevelSet.add(key);
    });
    const programLevels = [...programLevelSet].sort((a, b) => {
      // Sort by Level first so same level from each program are consecutive, then by program
      const [progA, lvlStrA] = a.split('|Level ');
      const [progB, lvlStrB] = b.split('|Level ');
      const lvlA = Number(lvlStrA) || 0;
      const lvlB = Number(lvlStrB) || 0;
      if (lvlA !== lvlB) return lvlA - lvlB;
      return progA.localeCompare(progB);
    });

    // Create matrix: matrix[date][programLevel] = [courses]
    const matrix = {};
    const dayInfo = {}; // Store day of week and group type

    generatedSchedule.schedule.forEach(item => {
      const date = item.exam_date;
      const programLevel = `${item.course.program}|Level ${item.course.level}`;

      if (!matrix[date]) {
        matrix[date] = {};
        dayInfo[date] = {
          dayOfWeek: item.day_of_week,
          groupType: item.group_type
        };
      }

      if (!matrix[date][programLevel]) {
        matrix[date][programLevel] = [];
      }

      matrix[date][programLevel].push(item);
    });

    return { dates, programLevels, matrix, dayInfo };
  };

  const groupedSchedule = groupScheduleByDateAndPeriod();
  const matrixView = createMatrixView();

  return (
    <div className="card w-full relative">
      {/* Step 3 vs Start All Over Choice Modal */}
      {showChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-6 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-xl bg-hue-gold/10 text-hue-navy flex items-center justify-center text-2xl font-bold">
                ⚙️
              </div>
              <div>
                <h3 className="text-lg font-bold text-hue-navy">Schedule Generation Mode</h3>
                <p className="text-xs text-slate-500">You have {lockedCount} pre-scheduled course(s) from Step 4.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Continue with Step 4 */}
              <button
                onClick={() => handleGenerateSchedule(false)}
                className="w-full text-left p-4 rounded-xl border-2 border-hue-navy/20 hover:border-hue-gold bg-slate-50 hover:bg-hue-gold/5 transition-all group cursor-pointer flex items-start gap-4"
              >
                <div className="text-2xl mt-0.5">🔒</div>
                <div>
                  <div className="font-bold text-sm text-hue-navy group-hover:text-hue-gold transition-colors">
                    Continue with Step 4 Pre-Scheduled Assignments
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Keep your {lockedCount} locked course(s) from Step 4 fixed in place on the calendar, and let AI auto-schedule all remaining courses around them.
                  </div>
                </div>
              </button>

              {/* Option 2: Start All Over */}
              <button
                onClick={() => handleGenerateSchedule(true)}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-red-400 bg-slate-50 hover:bg-red-50/50 transition-all group cursor-pointer flex items-start gap-4"
              >
                <div className="text-2xl mt-0.5">🔄</div>
                <div>
                  <div className="font-bold text-sm text-slate-800 group-hover:text-red-600 transition-colors">
                    Start All Over (Ignore Step 4)
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Ignore all manual pre-scheduled assignments and generate a completely fresh AI schedule from scratch for all courses.
                  </div>
                </div>
              </button>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button className="btn btn-secondary btn-sm text-xs" onClick={onBack}>
                ← Return to Step 4 (Pre-Scheduling)
              </button>
              <button className="text-xs text-slate-400 hover:text-slate-600 underline" onClick={() => setShowChoiceModal(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2>Generate & View Schedule</h2>
        <div className="flex gap-2">
          {lockedCount > 0 && (
            <button 
              onClick={() => setShowChoiceModal(true)}
              className="btn btn-secondary btn-sm border-hue-gold/50 text-hue-navy hover:bg-hue-gold/10 font-bold"
            >
              ⚙️ Generation Options ({lockedCount} locked)
            </button>
          )}
          <button 
            onClick={() => lockedCount > 0 ? setShowChoiceModal(true) : handleGenerateSchedule(true)}
            className="btn btn-primary btn-sm shadow-glow-primary font-bold"
            disabled={loading}
          >
            ⚡ Re-Generate Schedule
          </button>
        </div>
      </div>

      {error && <div className="bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger px-4 py-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

      {!generatedSchedule && (
        <div className="text-center py-12">
          <p className="text-slate-500 mb-8 max-w-lg mx-auto">
            Click the button below to generate the exam schedule based on the uploaded data and constraints.
          </p>
          <div className="flex justify-center gap-4">
            <button className="btn btn-secondary w-32" onClick={onBack}>
              Back
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleGenerateSchedule}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Generating...
                </span>
              ) : 'Generate Schedule'}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <svg className="animate-spin h-10 w-10 text-hue-navy mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="font-medium">Generating optimized schedule... This may take a moment.</p>
        </div>
      )}

      {generatedSchedule && generatedSchedule.schedule && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h3 className="mb-1">Generated Schedule ({generatedSchedule.schedule.length} exams)</h3>
              <p className="text-slate-500 text-sm font-medium">
                Schedule generated successfully with <span className={generatedSchedule.violations?.length > 0 ? "text-semantic-warning font-bold" : "text-semantic-success font-bold"}>{generatedSchedule.violations?.length || 0} violations</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                className="btn btn-secondary btn-sm border-hue-gold/60 text-hue-navy hover:bg-hue-gold/15 font-bold" 
                onClick={() => setShowVaultModal(true)}
              >
                🏛️ Schedule Vault & Compare
              </button>
              <button 
                className="btn btn-secondary btn-sm border-slate-300 text-slate-700 font-semibold" 
                onClick={() => window.open(`/api/scheduler/backup/${sessionId}`, '_blank')}
              >
                💾 Backup Session (.json)
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportToMarkdown}>
                📥 Export Markdown
              </button>
              <button className="btn btn-secondary btn-sm text-slate-500 hover:text-red-600" onClick={onReset}>
                🔄 New Session
              </button>
            </div>
          </div>

          {/* Schedule Vault Modal */}
          {showVaultModal && (
            <ScheduleVaultModal
              sessionId={sessionId}
              currentSchedule={generatedSchedule}
              lockedAssignments={lockedAssignments}
              onSelectSchedule={(vaultedSchedule) => {
                setGeneratedSchedule(vaultedSchedule);
                onScheduleGenerated(vaultedSchedule);
              }}
              onClose={() => setShowVaultModal(false)}
            />
          )}

          {/* Program Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {(() => {
              const pharmdCourses = generatedSchedule.schedule.filter(item => item.course.program === 'PharmD');
              const clinicalCourses = generatedSchedule.schedule.filter(item => item.course.program === 'PharmD Clinical');

              return (
                <>
                  <div className="stat-card bg-gradient-hero text-white border-0 shadow-glow-primary">
                    <h4 className="text-white/90 text-sm font-semibold uppercase tracking-wider mb-2">📚 PharmD Program</h4>
                    <div className="text-4xl font-bold font-outfit">{pharmdCourses.length}</div>
                    <div className="text-sm text-white/80 mt-1">courses scheduled</div>
                  </div>

                  <div className="stat-card bg-gradient-gold text-hue-navy border-0 shadow-glow-gold">
                    <h4 className="text-hue-navy/80 text-sm font-semibold uppercase tracking-wider mb-2">🏥 PharmD Clinical</h4>
                    <div className="text-4xl font-bold font-outfit">{clinicalCourses.length}</div>
                    <div className="text-sm text-hue-navy/80 mt-1">courses scheduled</div>
                  </div>

                  <div className="stat-card bg-white text-slate-800">
                    <h4 className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">📅 Exam Days</h4>
                    <div className="text-4xl font-bold font-outfit text-hue-navy">{matrixView.dates.length}</div>
                    <div className="text-sm text-slate-500 mt-1">days used in session</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Matrix View: Program-Level as Columns, Days as Rows */}
          <div className="mb-12">
            <h3 className="mb-4">📅 Schedule Matrix View</h3>
            <div className="table-container">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0] z-10 w-28 whitespace-nowrap">Date</th>
                    <th className="whitespace-nowrap">Day</th>
                    <th className="whitespace-nowrap">Group</th>
                    {matrixView.programLevels.map((pl, idx) => {
                      const [program, level] = pl.split('|');
                      return (
                        <th key={idx} className="min-w-[200px] border-l border-slate-200">
                          <span className="block text-hue-navy">{program}</span>
                          <span className="block text-slate-400 font-normal">{level}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixView.dates.map((date, dateIdx) => (
                    <tr key={dateIdx} className="table-row">
                      <td className="table-cell sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0] font-semibold text-hue-navy">
                        {date}
                      </td>
                      <td className="table-cell font-medium">
                        {matrixView.dayInfo[date]?.dayOfWeek}
                      </td>
                      <td className="table-cell">
                        <span className="badge badge-gray">{matrixView.dayInfo[date]?.groupType}</span>
                      </td>
                      {matrixView.programLevels.map((pl, plIdx) => {
                        const courses = matrixView.matrix[date]?.[pl] || [];
                        return (
                          <td key={plIdx} className={`p-3 align-top border-l border-slate-100 ${courses.length > 0 ? 'bg-hue-navy/5' : ''}`}>
                            {courses.length > 0 ? (
                              <div className="space-y-2">
                                {courses.sort((a,b) => a.period - b.period).map((item, idx) => (
                                  <div key={idx} className={`p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm ${idx < courses.length - 1 ? 'mb-2' : ''}`}>
                                    <div className="font-bold text-hue-navy mb-0.5">
                                      {item.course.course_code}
                                    </div>
                                    <div className="text-xs text-slate-600 font-medium leading-snug mb-2 line-clamp-2" title={item.course.course_title}>
                                      {item.course.course_title}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      <span className="badge badge-gray text-[10px] px-1.5 py-0.5 border border-slate-300 shadow-sm">Period {item.period}</span>
                                      {item.course.has_oral_exam && (
                                        <span className="badge badge-info text-[10px] px-1.5 py-0.5">🎤 Oral</span>
                                      )}
                                      {item.course.student_count && (
                                        <span className="badge badge-gray text-[10px] px-1.5 py-0.5 bg-slate-100">👥 {item.course.student_count}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex justify-center items-center h-full min-h-[60px] text-slate-300">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed List View */}
          <div className="mb-12">
            <h3 className="mb-4">📋 Detailed Schedule List</h3>
            {Object.keys(groupedSchedule).sort().map(key => {
              const dayGroup = groupedSchedule[key];
              const totalStudents = dayGroup.exams.reduce((sum, e) => sum + (e.course.student_count || 0), 0);
              return (
              <div key={key} className="mb-8">
                <h4 className="bg-hue-navy text-white px-4 py-2.5 rounded-t-xl mb-0 flex items-center gap-2 justify-between">
                  <div>
                    <span className="font-bold">{dayGroup.date}</span>
                    <span className="text-white/70 font-normal ml-2">| {dayGroup.dayOfWeek} (Group {dayGroup.groupType})</span>
                    <span className="ml-4 badge badge-info bg-white/20 border-0 text-white">Period {dayGroup.period}</span>
                  </div>
                  <div className="text-sm font-medium text-white/80">
                    Total Students: <span className={totalStudents > 1000 ? "text-red-400 font-bold" : ""}>{totalStudents}</span> / 1000
                  </div>
                </h4>

                <div className="table-container rounded-t-none border-t-0 shadow-none border-x border-b">
                  <table className="w-full text-sm">
                    <thead className="table-header">
                      <tr>
                        <th className="w-1/6">Program</th>
                        <th className="w-1/6">Level</th>
                        <th className="w-1/6">Course Code</th>
                        <th className="w-2/6">Course Title</th>
                        <th className="w-1/6 text-center">Oral Exam</th>
                        <th className="w-1/6 text-center">Students</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dayGroup.exams.map((item, idx) => (
                        <tr key={idx} className="table-row">
                          <td className="table-cell font-medium">{item.course.program}</td>
                          <td className="table-cell text-slate-500">{item.course.level}</td>
                          <td className="table-cell font-bold text-hue-navy">{item.course.course_code}</td>
                          <td className="table-cell">{item.course.course_title}</td>
                          <td className="table-cell text-center">
                            {item.course.has_oral_exam ? <span className="badge badge-info">Yes</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="table-cell text-center font-medium">~{item.course.student_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )})}
          </div>

          {generatedSchedule.violations && generatedSchedule.violations.length > 0 && (
            <div className="bg-semantic-warning/10 border-l-4 border-semantic-warning rounded-r-xl p-5 mb-8">
              <h3 className="text-semantic-warning mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Violations & Warnings
              </h3>
              <p className="text-sm text-yellow-800/80 mb-4 font-medium">
                The following constraints could not be fully satisfied:
              </p>
              <div className="space-y-2">
                {generatedSchedule.violations.map((violation, idx) => (
                  <div key={idx} className="bg-white/60 px-3 py-2 rounded-lg text-sm text-yellow-900 border border-yellow-200/50">
                    <strong className="text-semantic-warning mr-2">{violation.type}:</strong> {violation.course} 
                    <span className="text-slate-500 ml-2">({violation.program}, Level {violation.level})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScheduleViewer;


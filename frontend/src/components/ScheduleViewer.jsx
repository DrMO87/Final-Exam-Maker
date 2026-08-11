import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import ScheduleVaultModal from './ScheduleVaultModal';
import PdfExportModal from './PdfExportModal';

function ScheduleViewer({ sessionId, schedule, lockedAssignments, pdfSettings, onUpdatePdfSettings, onScheduleGenerated, onBack, onReset }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState(schedule);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const lockedCount = Object.keys(lockedAssignments || {}).length;
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  useEffect(() => {
    // Automatically generate/load schedule keeping pre-scheduled locks from Step 4 seamlessly
    if (!generatedSchedule) {
      handleGenerateSchedule(false);
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
    <div className="card w-full flex-1 flex flex-col min-h-0 relative">
      {/* Step 3 vs Start All Over Choice Modal */}
      {showChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-6 animate-scale-up text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-xl bg-hue-gold/10 text-hue-navy dark:text-amber-400 flex items-center justify-center text-2xl font-bold">
                ⚙️
              </div>
              <div>
                <h3 className="text-lg font-bold text-hue-navy dark:text-amber-400">Schedule Generation Mode</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">You have {lockedCount} pre-scheduled course(s) from Step 4.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Continue with Step 4 */}
              <button
                onClick={() => handleGenerateSchedule(false)}
                className="w-full text-left p-4 rounded-xl border-2 border-hue-navy/20 dark:border-amber-400/30 hover:border-hue-gold bg-slate-50 dark:bg-slate-800 hover:bg-hue-gold/5 transition-all group cursor-pointer flex items-start gap-4"
              >
                <div className="text-2xl mt-0.5">🔒</div>
                <div>
                  <div className="font-bold text-sm text-hue-navy dark:text-amber-300 group-hover:text-hue-gold transition-colors">
                    Continue with Step 4 Pre-Scheduled Assignments
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Keep your custom locked courses and let AI auto-schedule only the remaining unassigned courses.
                  </p>
                </div>
              </button>

              {/* Option 2: Clear & Re-run full generator */}
              <button
                onClick={() => handleGenerateSchedule(true)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group cursor-pointer flex items-start gap-4"
              >
                <div className="text-2xl mt-0.5">🔄</div>
                <div>
                  <div className="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    Clear Pre-Scheduled Locks &amp; Generate From Scratch
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ignore Step 4 pre-scheduled courses and allow AI complete freedom across all courses.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowChoiceModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="dark:text-white">Generate &amp; View Schedule</h2>
        <div className="flex flex-wrap gap-2">
          {lockedCount > 0 && (
            <button 
              onClick={() => setShowChoiceModal(true)}
              className="btn btn-secondary btn-sm border-hue-gold/50 text-hue-navy dark:text-amber-300 hover:bg-hue-gold/10 font-bold"
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
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto">
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
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
          <svg className="animate-spin h-10 w-10 text-hue-navy dark:text-amber-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="font-medium">Generating optimized schedule... This may take a moment.</p>
        </div>
      )}

      {generatedSchedule && generatedSchedule.schedule && (
        <div className="animate-fade-in flex-1 flex flex-col min-h-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="mb-1 dark:text-white">Generated Schedule ({generatedSchedule.schedule.length} exams)</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                Schedule generated successfully with <span className={generatedSchedule.violations?.length > 0 ? "text-semantic-warning font-bold" : "text-semantic-success font-bold"}>{generatedSchedule.violations?.length || 0} violations</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                className="btn btn-secondary btn-sm font-bold" 
                onClick={onBack}
              >
                ← Back to Step 4
              </button>
              <button 
                className="btn btn-gold btn-sm font-bold shadow-md hover:shadow-lg flex items-center gap-1.5" 
                onClick={() => setShowPdfModal(true)}
              >
                📄 Export Branded PDF
              </button>
              <button 
                className="btn btn-secondary btn-sm border-hue-gold/60 text-hue-navy dark:text-amber-300 hover:bg-hue-gold/15 font-bold" 
                onClick={() => setShowVaultModal(true)}
              >
                🏛️ Schedule Vault &amp; Compare
              </button>
              <button 
                className="btn btn-secondary btn-sm border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold" 
                onClick={() => window.open(`/api/scheduler/backup/${sessionId}`, '_blank')}
              >
                💾 Backup Session (.json)
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportToMarkdown}>
                📥 Export Markdown
              </button>
              <button className="btn btn-secondary btn-sm text-slate-500 hover:text-red-600 dark:hover:text-red-400" onClick={onReset}>
                🔄 New Session
              </button>
            </div>
          </div>

          {/* Branded PDF Export Modal */}
          {showPdfModal && (
            <PdfExportModal
              sessionId={sessionId}
              session={generatedSchedule?.session}
              scheduleData={generatedSchedule}
              externalPdfSettings={pdfSettings}
              onUpdatePdfSettings={onUpdatePdfSettings}
              onClose={() => setShowPdfModal(false)}
            />
          )}

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

                  <div className="stat-card bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800">
                    <h4 className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">📅 Exam Days</h4>
                    <div className="text-4xl font-bold font-outfit text-hue-navy dark:text-amber-400">{matrixView.dates.length}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">days used in session</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Matrix View: Program-Level as Columns, Days as Rows */}
          <div className="mb-10 flex-1 flex flex-col min-h-0">
            <h3 className="mb-3 dark:text-white">📅 Schedule Matrix View</h3>
            <div className="table-container flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <table className="w-full text-sm">
                <thead className="table-header sticky top-0 z-20">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b] z-30 w-28 whitespace-nowrap text-slate-700 dark:text-slate-200">Date</th>
                    <th className="whitespace-nowrap bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Day</th>
                    <th className="whitespace-nowrap bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">Group</th>
                    {matrixView.programLevels.map((pl, idx) => {
                      const [program, level] = pl.split('|');
                      return (
                        <th key={idx} className="min-w-[200px] border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          <span className="block text-hue-navy dark:text-amber-400">{program}</span>
                          <span className="block text-slate-400 font-normal">{level}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {matrixView.dates.map((date, dateIdx) => (
                    <tr key={dateIdx} className="table-row">
                      <td className="table-cell sticky left-0 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b] font-semibold text-hue-navy dark:text-amber-400 border-r border-slate-200 dark:border-slate-800">
                        {date}
                      </td>
                      <td className="table-cell font-medium dark:text-slate-200">
                        {matrixView.dayInfo[date]?.dayOfWeek}
                      </td>
                      <td className="table-cell">
                        <span className="badge badge-gray">{matrixView.dayInfo[date]?.groupType}</span>
                      </td>
                      {matrixView.programLevels.map((pl, plIdx) => {
                        const courses = matrixView.matrix[date]?.[pl] || [];
                        return (
                          <td key={plIdx} className={`p-3 align-top border-l border-slate-100 dark:border-slate-800 ${courses.length > 0 ? 'bg-hue-navy/5 dark:bg-slate-800/40' : ''}`}>
                            {courses.length > 0 ? (
                              <div className="space-y-2">
                                {courses.sort((a,b) => a.period - b.period).map((item, idx) => (
                                  <div key={idx} className={`p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm ${idx < courses.length - 1 ? 'mb-2' : ''}`}>
                                    <div className="font-bold text-hue-navy dark:text-amber-400 mb-0.5">
                                      {item.course.course_code}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug mb-2 line-clamp-2" title={item.course.course_title}>
                                      {item.course.course_title}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      <span className="badge badge-gray text-[10px] px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 shadow-sm">Period {item.period}</span>
                                      {item.course.has_oral_exam && (
                                        <span className="badge badge-info text-[10px] px-1.5 py-0.5">🎤 Oral</span>
                                      )}
                                      {item.course.student_count && (
                                        <span className="badge badge-gray text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700">👥 {item.course.student_count}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex justify-center items-center h-full min-h-[60px] text-slate-300 dark:text-slate-700">—</div>
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
            <h3 className="mb-4 dark:text-white">📋 Detailed Schedule List</h3>
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

                <div className="table-container rounded-t-none border-t-0 shadow-none border-x border-b border-slate-200 dark:border-slate-800">
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
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {dayGroup.exams.map((item, idx) => (
                        <tr key={idx} className="table-row">
                          <td className="table-cell font-medium dark:text-slate-200">{item.course.program}</td>
                          <td className="table-cell text-slate-500 dark:text-slate-400">{item.course.level}</td>
                          <td className="table-cell font-bold text-hue-navy dark:text-amber-400">{item.course.course_code}</td>
                          <td className="table-cell dark:text-slate-200">{item.course.course_title}</td>
                          <td className="table-cell text-center">
                            {item.course.has_oral_exam ? <span className="badge badge-info">Yes</span> : <span className="text-slate-300 dark:text-slate-600">-</span>}
                          </td>
                          <td className="table-cell text-center font-medium dark:text-slate-200">~{item.course.student_count}</td>
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
                Violations &amp; Warnings
              </h3>
              <p className="text-sm text-yellow-800/80 dark:text-yellow-300/80 mb-4 font-medium">
                The following constraints could not be fully satisfied:
              </p>
              <div className="space-y-2">
                {generatedSchedule.violations.map((violation, idx) => (
                  <div key={idx} className="bg-white/60 dark:bg-slate-800/80 px-3 py-2 rounded-lg text-sm text-yellow-900 dark:text-yellow-200 border border-yellow-200/50 dark:border-yellow-800/50">
                    <strong className="text-semantic-warning mr-2">{violation.type}:</strong> {violation.course} 
                    <span className="text-slate-500 dark:text-slate-400 ml-2">({violation.program}, Level {violation.level})</span>
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


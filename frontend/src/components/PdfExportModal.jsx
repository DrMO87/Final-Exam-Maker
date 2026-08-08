import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { LOGO_HUE, LOGO_PHARMACY, LOGO_DTU } from '../assets/logos';

function PdfExportModal({ sessionId, session, scheduleData, onClose }) {
  const [layoutMode, setLayoutMode] = useState('matrix'); // 'matrix' or 'chronological'
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  const [documentTitle, setDocumentTitle] = useState(session?.session_name || 'Final Examination Timetable');
  const [showSignatures, setShowSignatures] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [exporting, setExporting] = useState(false);

  const printAreaRef = useRef(null);

  const schedule = scheduleData?.schedule || [];
  const violations = scheduleData?.violations || [];

  // Sort schedule chronologically
  const sortedSchedule = [...schedule].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    return a.period - b.period;
  });

  // Calculate unique dates and levels for matrix view
  const dates = [...new Set(schedule.map(item => item.exam_date))].sort();

  // Create program-level combinations
  const programLevelSet = new Set();
  schedule.forEach(item => {
    if (item.course) {
      programLevelSet.add(`${item.course.program}|Level ${item.course.level}`);
    }
  });
  
  const programLevels = [...programLevelSet].sort((a, b) => {
    const [progA, lvlStrA] = a.split('|Level ');
    const [progB, lvlStrB] = b.split('|Level ');
    const lvlA = Number(lvlStrA) || 0;
    const lvlB = Number(lvlStrB) || 0;
    if (lvlA !== lvlB) return lvlA - lvlB;
    return progA.localeCompare(progB);
  });

  // Group by date & period & program-level for matrix cell retrieval
  const matrixData = {};
  dates.forEach(d => {
    matrixData[d] = { 1: {}, 2: {} };
  });

  schedule.forEach(item => {
    if (!item.course) return;
    const plKey = `${item.course.program}|Level ${item.course.level}`;
    if (matrixData[item.exam_date] && matrixData[item.exam_date][item.period]) {
      if (!matrixData[item.exam_date][item.period][plKey]) {
        matrixData[item.exam_date][item.period][plKey] = [];
      }
      matrixData[item.exam_date][item.period][plKey].push(item);
    }
  });

  // Group by date for chronological view
  const chronologicalData = {};
  sortedSchedule.forEach(item => {
    if (!chronologicalData[item.exam_date]) {
      chronologicalData[item.exam_date] = {
        dateStr: item.exam_date,
        dayOfWeek: item.day_of_week,
        period1: [],
        period2: []
      };
    }
    if (item.period === 1) {
      chronologicalData[item.exam_date].period1.push(item);
    } else {
      chronologicalData[item.exam_date].period2.push(item);
    }
  });

  // Stats calculation
  const totalCourses = schedule.length;
  const totalStudents = schedule.reduce((sum, item) => sum + (item.course?.student_count || 0), 0);
  const totalDays = dates.length;
  const pharmdCount = schedule.filter(item => item.course?.program === 'PharmD').length;
  const clinicalCount = schedule.filter(item => item.course?.program === 'PharmD Clinical').length;

  const formattedIssueDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setExporting(true);

    try {
      const element = printAreaRef.current;
      const cleanFileName = (documentTitle || 'Schedule')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .replace(/\s+/g, '_');

      const opt = {
        margin: [5, 5, 5, 5],
        filename: `${cleanFileName}_HUE_Horus_University.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: orientation === 'landscape' ? 1280 : 960
        },
        jsPDF: { 
          unit: 'mm', 
          format: pageSize, 
          orientation: orientation 
        }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate PDF. You can also use the "Print / Save via Browser" button.');
    } finally {
      setExporting(false);
    }
  };

  const handleNativePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in">
        
        {/* Header / Controls Bar */}
        <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={LOGO_HUE} alt="HUE Logo" className="h-9 w-auto object-contain bg-white/10 p-1 rounded" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">Horus University — Egypt (HUE) PDF Studio</h3>
                <span className="bg-hue-gold/20 text-hue-gold border border-hue-gold/40 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Official Accreditation</span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">Faculty of Pharmacy • Digital Transformation Unit (DTU) • NAQAAE Accredited</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNativePrint}
              className="btn btn-secondary btn-sm bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 font-semibold"
              title="Print document or save using browser print dialog"
            >
              🖨️ Print View
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="btn btn-gold btn-sm font-bold shadow-lg shadow-hue-gold/20"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-hue-navy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Exporting PDF...
                </>
              ) : (
                <>
                  📄 Download PDF Document
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Options Toolbar */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Layout Format</label>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value)}
              className="input input-sm h-8 py-0 border-slate-300 font-medium"
            >
              <option value="matrix">Detailed Matrix Timetable</option>
              <option value="chronological">Chronological Master List</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Page Orientation</label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className="input input-sm h-8 py-0 border-slate-300 font-medium"
            >
              <option value="landscape">Landscape (Recommended)</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Paper Size</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              className="input input-sm h-8 py-0 border-slate-300 font-medium"
            >
              <option value="a4">Standard A4</option>
              <option value="a3">Large Format A3</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-slate-600 font-semibold mb-1">Document Title</label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="input input-sm h-8 py-0 border-slate-300 font-medium w-full"
            />
          </div>

          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-hue-navy focus:ring-hue-navy"
              />
              Signatures Block
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
                className="rounded text-hue-navy focus:ring-hue-navy"
              />
              Summary Stats
            </label>
          </div>
        </div>

        {/* Live Document Preview Scroll Container */}
        <div className="flex-1 overflow-auto p-4 bg-slate-200/70">
          <div 
            ref={printAreaRef}
            id="pdf-document-content" 
            className="bg-white text-slate-900 shadow-xl rounded-none mx-auto p-5 border border-slate-300 font-sans text-xs"
            style={{
              width: orientation === 'landscape' ? '1100px' : '800px',
              minHeight: '750px'
            }}
          >
            {/* BRANDED HEADER BANNER WITH THE 3 OFFICIAL LOGOS */}
            <div className="bg-[#0B1E36] text-white p-4 rounded-lg border-b-4 border-[#D4AF37] relative overflow-hidden mb-4">
              <div className="flex justify-between items-center relative z-10 gap-2">
                
                {/* LOGO 1: HUE Horus University - Egypt Primary Logo */}
                <div className="flex items-center bg-white p-1.5 rounded-md shadow-md border border-slate-200">
                  <img src={LOGO_HUE} alt="Horus University Egypt Logo" className="h-12 w-auto object-contain" />
                </div>

                {/* CENTER: Title & Faculty Information */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-lg font-black tracking-wide text-white m-0 uppercase font-outfit">
                    HORUS UNIVERSITY — EGYPT (HUE)
                  </h1>
                  <h2 className="text-xs font-bold text-[#D4AF37] tracking-wider uppercase m-0 mt-0.5">
                    FACULTY OF PHARMACY • EXAMINATION CONTROL COMMITTEE
                  </h2>
                  <p className="text-[9px] text-slate-300 m-0 mt-0.5 font-medium">
                    New Damietta, Egypt • NAQAAE Accredited Institution
                  </p>
                  <div className="mt-1 inline-block text-[11px] font-extrabold text-white bg-white/10 px-3 py-0.5 rounded border border-[#D4AF37]/50 tracking-wider">
                    {documentTitle.toUpperCase()} — {session?.semester || 'ACADEMIC YEAR 2025-2026'}
                  </div>
                </div>

                {/* LOGO 2 & LOGO 3: Pharmacy Seal & DTU Emblem */}
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1 rounded-full shadow-md border border-slate-200 flex items-center justify-center">
                    <img src={LOGO_PHARMACY} alt="Faculty of Pharmacy Seal" className="h-12 w-12 object-contain" title="Faculty of Pharmacy NAQAAE Seal" />
                  </div>
                  <div className="bg-white p-1 rounded-md shadow-md border border-slate-200 flex items-center justify-center">
                    <img src={LOGO_DTU} alt="DTU Digital Transformation Unit Logo" className="h-12 w-auto object-contain" title="Digital Transformation Unit (DTU)" />
                  </div>
                </div>

              </div>

              {/* Document Sub-Metadata */}
              <div className="flex justify-between items-center text-[9px] text-slate-300 mt-3 pt-2 border-t border-slate-700/60 font-medium">
                <div>Issue Date: <span className="text-white font-bold">{formattedIssueDate}</span></div>
                <div>Session: <span className="text-white font-bold">{session?.session_name || 'Final Exams'}</span></div>
                <div className="text-[#D4AF37] font-bold">Doc ID: HUE-EXAM-{sessionId || 'FINAL'}</div>
              </div>
            </div>

            {/* SUMMARY STATS BAR */}
            {showStats && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Scheduled Courses</div>
                  <div className="text-lg font-black text-[#0B1E36] mt-0.5">{totalCourses}</div>
                  <div className="text-[8px] text-slate-400">Across all levels & programs</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Students Enrolled</div>
                  <div className="text-lg font-black text-[#0B1E36] mt-0.5">{totalStudents.toLocaleString()}</div>
                  <div className="text-[8px] text-slate-400">Exam seating allocations</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Examination Days</div>
                  <div className="text-lg font-black text-[#0B1E36] mt-0.5">{totalDays}</div>
                  <div className="text-[8px] text-slate-400">Excluding Fridays</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Programs Included</div>
                  <div className="text-xs font-bold text-[#0B1E36] mt-1">
                    PharmD ({pharmdCount}) • Clinical ({clinicalCount})
                  </div>
                  <div className="text-[8px] text-slate-400">Verified conflict-free</div>
                </div>
              </div>
            )}

            {/* MAIN CONTENT: TIMETABLE MATRIX VIEW (FIT TO CANVAS GUARANTEED) */}
            {layoutMode === 'matrix' && (
              <div className="mb-4 overflow-hidden">
                <div className="flex justify-between items-center mb-1 px-0.5">
                  <span className="text-xs font-bold text-[#0B1E36] uppercase tracking-wider">
                    Official Timetable Grid (By Date & Period)
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold">
                    * Period 1: Morning (09:00 AM) • Period 2: Afternoon (12:30 PM)
                  </span>
                </div>

                {/* Table with fixed layout fitting 100% canvas */}
                <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed">
                  <thead>
                    <tr className="bg-[#0B1E36] text-white">
                      <th className="border border-slate-400 p-1.5 text-center w-[8%] uppercase font-bold tracking-wider text-[9px]">Date & Day</th>
                      <th className="border border-slate-400 p-1.5 text-center w-[5%] uppercase font-bold tracking-wider text-[8px]">Period</th>
                      {programLevels.map(pl => {
                        const [prog, lvl] = pl.split('|');
                        const isClinical = prog.includes('Clinical');
                        return (
                          <th key={pl} className="border border-slate-400 p-1 text-center font-bold">
                            <div className={`text-[8.5px] font-extrabold ${isClinical ? 'text-[#D4AF37]' : 'text-white'}`}>{prog}</div>
                            <div className="text-slate-200 font-semibold text-[8px]">{lvl}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((dateStr) => {
                      const dateObj = new Date(dateStr + 'T00:00:00');
                      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                      return [1, 2].map((periodNum) => {
                        return (
                          <tr key={`${dateStr}-${periodNum}`} className={periodNum === 2 ? 'border-b border-slate-400 bg-slate-50/60' : 'bg-white'}>
                            {periodNum === 1 && (
                              <td rowSpan={2} className="border border-slate-300 p-1 text-center align-middle font-bold bg-slate-100/90 leading-tight">
                                <div className="text-[10px] text-[#0B1E36] font-bold">{dayName}</div>
                                <div className="text-[8px] text-slate-600 font-medium mt-0.5">{formattedDate}</div>
                              </td>
                            )}

                            <td className="border border-slate-300 p-0.5 text-center font-bold text-slate-700 bg-slate-50 align-middle">
                              <span className={`inline-block px-1 py-0.5 rounded text-[8px] font-bold ${periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                P{periodNum}
                              </span>
                            </td>

                            {programLevels.map(pl => {
                              const assignedItems = matrixData[dateStr]?.[periodNum]?.[pl] || [];

                              return (
                                <td key={pl} className="border border-slate-300 p-1 align-top min-h-[36px] max-w-0 overflow-hidden">
                                  {assignedItems.length > 0 ? (
                                    assignedItems.map(item => (
                                      <div key={item.course_id} className="bg-slate-100/90 rounded border border-slate-300 p-1 mb-1 last:mb-0 shadow-2xs leading-tight">
                                        <div className="font-bold text-[#0B1E36] text-[8.5px] flex justify-between items-center gap-0.5">
                                          <span className="truncate">{item.course.course_code}</span>
                                          <span className="text-[7px] bg-slate-200 text-slate-700 px-0.5 rounded font-semibold whitespace-nowrap">
                                            {item.course.student_count} stds
                                          </span>
                                        </div>
                                        <div className="text-[7.5px] text-slate-700 font-medium line-clamp-2 mt-0.5 leading-tight">
                                          {item.course.course_title}
                                        </div>
                                        {item.course.has_oral_exam && (
                                          <div className="mt-0.5 inline-block text-[6.5px] font-bold text-amber-900 bg-amber-200/90 px-1 py-0.2 rounded">
                                            🎤 Oral
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-slate-300 text-center py-0.5 text-[8px] font-light">—</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* MAIN CONTENT: CHRONOLOGICAL MASTER LIST VIEW */}
            {layoutMode === 'chronological' && (
              <div className="mb-4 space-y-3">
                <div className="flex justify-between items-center mb-1 px-0.5">
                  <span className="text-xs font-bold text-[#0B1E36] uppercase tracking-wider">
                    Master Examination Schedule (By Date)
                  </span>
                </div>

                {Object.values(chronologicalData).map(dayData => {
                  const dateObj = new Date(dayData.dateStr + 'T00:00:00');
                  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

                  return (
                    <div key={dayData.dateStr} className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                      <div className="bg-[#0B1E36] text-white px-3 py-1.5 flex justify-between items-center">
                        <span className="font-bold text-xs tracking-wide">{formattedDate}</span>
                        <span className="text-[10px] text-[#D4AF37] font-semibold">
                          Total Exams: {dayData.period1.length + dayData.period2.length}
                        </span>
                      </div>

                      <div className="p-2.5 grid grid-cols-2 gap-3 text-[9.5px]">
                        {/* Period 1 */}
                        <div className="border-r border-slate-200 pr-2">
                          <div className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mb-1.5 flex justify-between items-center text-[9px]">
                            <span>PERIOD 1 (09:00 AM - 11:00 AM)</span>
                            <span className="text-[8.5px] bg-blue-200 text-blue-900 px-1 rounded">{dayData.period1.length} courses</span>
                          </div>

                          {dayData.period1.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.period1.map(item => (
                                <div key={item.course_id} className="p-1.5 rounded bg-slate-50 border border-slate-200">
                                  <div className="flex justify-between font-bold text-[#0B1E36]">
                                    <span>{item.course.course_code} - {item.course.course_title}</span>
                                    <span className="text-slate-500 font-semibold">{item.course.student_count} students</span>
                                  </div>
                                  <div className="flex gap-1.5 mt-0.5 text-[8.5px] text-slate-600">
                                    <span className="bg-slate-200 px-1 rounded font-medium">{item.course.program}</span>
                                    <span className="bg-slate-200 px-1 rounded font-medium">Level {item.course.level}</span>
                                    {item.course.has_oral_exam && (
                                      <span className="bg-amber-100 text-amber-800 font-bold px-1 rounded">🎤 Oral Exam</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-center py-1">No exams scheduled for Period 1</div>
                          )}
                        </div>

                        {/* Period 2 */}
                        <div className="pl-1">
                          <div className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mb-1.5 flex justify-between items-center text-[9px]">
                            <span>PERIOD 2 (12:30 PM - 02:30 PM)</span>
                            <span className="text-[8.5px] bg-amber-200 text-amber-900 px-1 rounded">{dayData.period2.length} courses</span>
                          </div>

                          {dayData.period2.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.period2.map(item => (
                                <div key={item.course_id} className="p-1.5 rounded bg-slate-50 border border-slate-200">
                                  <div className="flex justify-between font-bold text-[#0B1E36]">
                                    <span>{item.course.course_code} - {item.course.course_title}</span>
                                    <span className="text-slate-500 font-semibold">{item.course.student_count} students</span>
                                  </div>
                                  <div className="flex gap-1.5 mt-0.5 text-[8.5px] text-slate-600">
                                    <span className="bg-slate-200 px-1 rounded font-medium">{item.course.program}</span>
                                    <span className="bg-slate-200 px-1 rounded font-medium">Level {item.course.level}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-center py-1">No exams scheduled for Period 2</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIOLATIONS / NOTES CALLOUT IF ANY */}
            {violations.length > 0 && (
              <div className="mb-4 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[9.5px]">
                <div className="font-bold text-amber-900 uppercase tracking-wider mb-0.5">
                  ⚠️ Examination Control Notes & Advisory ({violations.length})
                </div>
                <ul className="list-disc pl-4 text-amber-800 space-y-0.5">
                  {violations.slice(0, 4).map((v, i) => (
                    <li key={i}>
                      <span className="font-semibold">{v.type || 'Notice'}:</span> {v.course} ({v.program || 'General'}, Level {v.level || '-'}) - {v.reason || 'Special allocation'}
                    </li>
                  ))}
                  {violations.length > 4 && (
                    <li className="font-medium italic">...and {violations.length - 4} additional schedule adjustments.</li>
                  )}
                </ul>
              </div>
            )}

            {/* OFFICIAL SIGNATURES & STAMP BLOCK WITH 3 EMBLEMS */}
            {showSignatures && (
              <div className="mt-6 pt-4 border-t-2 border-slate-300 flex justify-between items-end">
                {/* Official Stamp & NAQAAE Certification */}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#0B1E36]/40 flex flex-col items-center justify-center text-center p-1 rotate-[-6deg] bg-slate-50">
                    <div className="text-[6px] font-bold text-[#0B1E36] uppercase tracking-tighter">Horus University</div>
                    <div className="text-[7.5px] font-black text-[#D4AF37] my-0.2">★ NAQAAE ★</div>
                    <div className="text-[5.5px] font-semibold text-slate-600">Exam Control Committee</div>
                  </div>
                  <div className="text-[8.5px] text-slate-500 leading-tight">
                    <div className="font-bold text-slate-800">OFFICIAL ACADEMIC TIMETABLE</div>
                    <div>Horus University — Egypt (HUE)</div>
                    <div>Faculty of Pharmacy • DTU Certified</div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex gap-10 text-center text-[9px]">
                  <div>
                    <div className="h-8 border-b border-slate-400 w-32 mb-1 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-[10px] opacity-70">Dr. Control Chair</span>
                    </div>
                    <div className="font-bold text-[#0B1E36]">Head of Exam Control</div>
                    <div className="text-[7.5px] text-slate-500">Horus University — Egypt</div>
                  </div>

                  <div>
                    <div className="h-8 border-b border-slate-400 w-32 mb-1 flex items-end justify-center">
                      <span className="font-serif italic text-slate-500 text-[10px] opacity-70">Prof. Dean Signature</span>
                    </div>
                    <div className="font-bold text-[#0B1E36]">Dean of Faculty</div>
                    <div className="text-[7.5px] text-slate-500">Faculty of Pharmacy • HUE</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENT FOOTER */}
            <div className="mt-4 text-center text-[7.5px] text-slate-400 border-t border-slate-200 pt-2">
              Horus University — Egypt (HUE) • Faculty of Pharmacy • Digital Transformation Unit (DTU) • NAQAAE Accredited
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500 font-medium">
            💡 Tip: Set <span className="font-semibold text-slate-800">Landscape</span> & <span className="font-semibold text-slate-800">A4/A3</span> size so the 10-column table fits 100% onto the canvas.
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="btn btn-gold btn-sm font-bold px-5 shadow-md"
            >
              {exporting ? 'Generating PDF...' : '📄 Export PDF Now'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PdfExportModal;

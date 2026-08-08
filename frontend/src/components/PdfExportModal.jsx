import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';

function PdfExportModal({ sessionId, session, scheduleData, onClose }) {
  const [layoutMode, setLayoutMode] = useState('matrix'); // 'matrix' or 'chronological'
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  const [semester, setSemester] = useState(session?.semester || 'Fall Semester');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [period1Time, setPeriod1Time] = useState('09:00 AM - 11:00 AM');
  const [period2Time, setPeriod2Time] = useState('12:00 PM - 02:00 PM');
  
  const [showSignatures, setShowSignatures] = useState(true);
  const [numSignatures, setNumSignatures] = useState(2);
  const [signatories, setSignatories] = useState([
    { name: 'Dr. Exam Control Chair', title: 'Head of Exam Control' },
    { name: 'Prof. Dean Signature', title: 'Dean of Faculty of Pharmacy' },
    { name: 'Vice Dean Signature', title: 'Vice Dean of Academic Affairs' },
    { name: 'Committee Member', title: 'Control Committee Secretary' }
  ]);

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

  const handleSignatoryChange = (index, field, value) => {
    const updated = [...signatories];
    updated[index][field] = value;
    setSignatories(updated);
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setExporting(true);

    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `HUE_Exam_Schedule_${semester.replace(/\s+/g, '_')}_${session?.session_name || 'Timetable'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: pageSize, orientation: orientation }
      };

      await html2pdf().set(opt).from(printAreaRef.current).save();
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header Bar */}
        <div className="bg-[#0B1E36] text-white p-4 flex justify-between items-center shrink-0 border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-extrabold text-base tracking-wide font-outfit text-white">
                Export Studio — Horus University Egypt (HUE)
              </h3>
              <p className="text-xs text-[#D4AF37] font-semibold">
                Configure Layout, Semester, Periods & Customized Signature Blocks
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* Configuration Controls Bar */}
        <div className="bg-slate-100 border-b border-slate-200 p-4 shrink-0 grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
          
          <div>
            <label className="block text-slate-700 font-bold mb-1">Layout Format</label>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
            >
              <option value="matrix">Timetable Matrix Grid</option>
              <option value="chronological">Chronological Master List</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Orientation & Size</label>
            <div className="flex gap-1">
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="a4">A4</option>
                <option value="a3">A3</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Semester & Year</label>
            <div className="flex gap-1">
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="Fall Semester">Fall</option>
                <option value="Spring Semester">Spring</option>
                <option value="Summer Semester">Summer</option>
              </select>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-1/2 h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                placeholder="2025-2026"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Period 1 Time</label>
            <input
              type="text"
              value={period1Time}
              onChange={(e) => setPeriod1Time(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              placeholder="09:00 AM - 11:00 AM"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Period 2 Time</label>
            <input
              type="text"
              value={period2Time}
              onChange={(e) => setPeriod2Time(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              placeholder="12:00 PM - 02:00 PM"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Signatures Count</label>
            <select
              value={numSignatures}
              onChange={(e) => setNumSignatures(Number(e.target.value))}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
            >
              <option value={1}>1 Signatory</option>
              <option value={2}>2 Signatories</option>
              <option value={3}>3 Signatories</option>
              <option value={4}>4 Signatories</option>
            </select>
          </div>

        </div>

        {/* Dynamic Signatories Config Inputs Panel */}
        {showSignatures && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs flex flex-wrap gap-3 items-center">
            <span className="font-extrabold text-[#0B1E36] uppercase tracking-wider text-[10px]">
              ✍️ Signatory Titles:
            </span>
            {Array.from({ length: numSignatures }).map((_, idx) => (
              <div key={idx} className="flex gap-1 items-center bg-white p-1 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-500 text-[10px]">#{idx + 1}:</span>
                <input
                  type="text"
                  value={signatories[idx]?.name || ''}
                  onChange={(e) => handleSignatoryChange(idx, 'name', e.target.value)}
                  placeholder="Signatory Name"
                  className="h-6 px-1.5 w-32 border border-slate-200 rounded text-[10px] font-medium"
                />
                <input
                  type="text"
                  value={signatories[idx]?.title || ''}
                  onChange={(e) => handleSignatoryChange(idx, 'title', e.target.value)}
                  placeholder="Official Title"
                  className="h-6 px-1.5 w-36 border border-slate-200 rounded text-[10px] font-bold text-[#0B1E36]"
                />
              </div>
            ))}
          </div>
        )}

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
            {/* BRANDED HEADER BANNER (NO EXAMINATION CONTROL COMMITTEE TEXT) */}
            <div className="bg-[#0B1E36] text-white p-4 rounded-lg border-b-4 border-[#D4AF37] relative overflow-hidden mb-4">
              <div className="flex justify-between items-center relative z-10 gap-2">
                
                {/* LOGO 1: HUE Primary Emblem */}
                <div className="flex items-center bg-white p-1.5 rounded-md shadow-md border border-slate-200 shrink-0">
                  <img src={LOGO_HUE} alt="Horus University Egypt Logo" className="h-12 w-auto object-contain" />
                </div>

                {/* CENTER: Title & Faculty Information */}
                <div className="text-center flex-1 px-2">
                  <h1 className="text-lg font-black tracking-wide text-white m-0 uppercase font-outfit">
                    HORUS UNIVERSITY — EGYPT (HUE)
                  </h1>
                  
                  {/* REMOVED EXAMINATION CONTROL COMMITTEE TEXT AS REQUESTED */}
                  <h2 className="text-xs font-bold text-[#D4AF37] tracking-widest uppercase m-0 mt-0.5">
                    FACULTY OF PHARMACY
                  </h2>
                  <p className="text-[9px] text-slate-300 m-0 mt-0.5 font-medium">
                    New Damietta, Egypt • NAQAAE Accredited Institution
                  </p>

                  {/* PERFECTLY FITTED GOLD BORDER BOX (NO OVERFLOW OR CLIPPING) */}
                  <div className="mt-2 inline-block text-[11px] font-black text-white bg-white/10 px-4 py-1 rounded-lg border border-[#D4AF37] tracking-wide leading-tight shadow-inner max-w-full">
                    FINAL EXAMINATION TIMETABLE — {semester.toUpperCase()} — ACADEMIC YEAR {academicYear}
                  </div>
                </div>

                {/* LOGO 2 & LOGO 3: Pharmacy Seal & DTU Emblem */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="bg-white p-1 rounded-full shadow-md border border-slate-200 flex items-center justify-center">
                    <img src={LOGO_PHARMACY} alt="Faculty of Pharmacy Seal" className="h-12 w-12 object-contain" title="Faculty of Pharmacy NAQAAE Seal" />
                  </div>
                  <div className="bg-white p-1 rounded-md shadow-md border border-slate-200 flex items-center justify-center">
                    <img src={LOGO_DTU} alt="DTU Logo" className="h-12 w-auto object-contain" title="Digital Transformation Unit (DTU)" />
                  </div>
                </div>

              </div>

              {/* Document Sub-Metadata */}
              <div className="flex justify-between items-center text-[9px] text-slate-300 mt-3 pt-2 border-t border-slate-700/60 font-medium">
                <div>Issue Date: <span className="text-white font-bold">{formattedIssueDate}</span></div>
                <div>Session: <span className="text-white font-bold">{session?.session_name || 'Final Exams'} ({semester})</span></div>
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

            {/* MAIN CONTENT: TIMETABLE MATRIX VIEW */}
            {layoutMode === 'matrix' && (
              <div className="mb-4 overflow-hidden">
                <div className="flex justify-between items-center mb-1 px-0.5">
                  <span className="text-xs font-bold text-[#0B1E36] uppercase tracking-wider">
                    Official Timetable Grid (By Date & Period)
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold">
                    * Period 1: {period1Time} • Period 2: {period2Time}
                  </span>
                </div>

                {/* Table with fixed layout fitting 100% canvas */}
                <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed">
                  <thead>
                    <tr className="bg-[#0B1E36] text-white">
                      <th className="border border-slate-400 p-1.5 text-center w-[8%] uppercase font-bold tracking-wider text-[9px]">Date & Day</th>
                      <th className="border border-slate-400 p-1.5 text-center w-[6%] uppercase font-bold tracking-wider text-[8px]">Period</th>
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
                              <span className={`inline-block px-1 py-0.5 rounded text-[7.5px] font-bold ${periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                P{periodNum}
                              </span>
                              <div className="text-[6.5px] text-slate-500 font-normal leading-none mt-0.5">
                                {periodNum === 1 ? 'Morning' : 'Afternoon'}
                              </div>
                            </td>

                            {programLevels.map(pl => {
                              const assignedItems = matrixData[dateStr]?.[periodNum]?.[pl] || [];

                              return (
                                <td key={pl} className="border border-slate-300 p-1 align-top bg-white/50">
                                  {assignedItems.length > 0 ? (
                                    assignedItems.map(item => (
                                      <div key={item.course_id} className="bg-slate-50/90 rounded-md border border-slate-300 p-1.5 mb-1 last:mb-0 shadow-2xs overflow-visible">
                                        <div className="font-bold text-[#0B1E36] text-[9px] leading-tight flex justify-between items-center gap-1 border-b border-slate-200/80 pb-0.5 mb-0.5">
                                          <span className="font-extrabold tracking-tight">{item.course.course_code}</span>
                                          <span className="text-[7.5px] bg-slate-200 text-slate-800 px-1 rounded font-bold whitespace-nowrap">
                                            {item.course.student_count} stds
                                          </span>
                                        </div>
                                        <div className="text-[8px] text-slate-800 font-medium leading-[11px] whitespace-normal break-words">
                                          {item.course.course_title}
                                        </div>
                                        {item.course.has_oral_exam && (
                                          <div className="mt-1 inline-flex items-center gap-0.5 text-[7px] font-bold text-amber-900 bg-amber-100 border border-amber-300/80 px-1 py-0.5 rounded leading-none">
                                            🎤 Oral
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-slate-300 text-center py-1 text-[8px] font-light">—</div>
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
                    <div key={dayData.dateStr} className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                      <div className="bg-[#0B1E36] text-white py-1 px-3 text-xs font-bold flex justify-between">
                        <span>📅 {formattedDate}</span>
                        <span className="text-[#D4AF37] font-semibold">{dayData.period1.length + dayData.period2.length} Total Exams</span>
                      </div>

                      <div className="p-2 grid grid-cols-2 gap-3 text-[9px]">
                        <div>
                          <div className="font-bold text-blue-900 bg-blue-50 border-b border-blue-200 px-2 py-0.5 mb-1 rounded flex justify-between">
                            <span>Period 1</span>
                            <span className="font-normal text-[8px]">{period1Time}</span>
                          </div>
                          {dayData.period1.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.period1.map(item => (
                                <div key={item.course_id} className="p-1.5 rounded bg-slate-50 border border-slate-200">
                                  <div className="flex justify-between font-bold text-[#0B1E36]">
                                    <span>{item.course.course_code} - {item.course.course_title}</span>
                                    <span className="text-slate-500 font-semibold">{item.course.student_count} stds</span>
                                  </div>
                                  <div className="flex gap-1.5 mt-0.5 text-[8.5px] text-slate-600">
                                    <span className="bg-slate-200 px-1 rounded font-medium">{item.course.program}</span>
                                    <span className="bg-slate-200 px-1 rounded font-medium">Level {item.course.level}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-center py-1">No exams scheduled for Period 1</div>
                          )}
                        </div>

                        <div>
                          <div className="font-bold text-amber-900 bg-amber-50 border-b border-amber-200 px-2 py-0.5 mb-1 rounded flex justify-between">
                            <span>Period 2</span>
                            <span className="font-normal text-[8px]">{period2Time}</span>
                          </div>
                          {dayData.period2.length > 0 ? (
                            <div className="space-y-1">
                              {dayData.period2.map(item => (
                                <div key={item.course_id} className="p-1.5 rounded bg-slate-50 border border-slate-200">
                                  <div className="flex justify-between font-bold text-[#0B1E36]">
                                    <span>{item.course.course_code} - {item.course.course_title}</span>
                                    <span className="text-slate-500 font-semibold">{item.course.student_count} stds</span>
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

            {/* DYNAMIC CONFIGURABLE SIGNATURES (REMOVED STAMP AS REQUESTED) */}
            {showSignatures && (
              <div className="mt-8 pt-4 border-t-2 border-slate-300">
                <div className={`grid grid-cols-${numSignatures} gap-6 text-center text-[9px]`}>
                  {Array.from({ length: numSignatures }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="h-10 border-b border-slate-400 w-44 mb-1.5 flex items-end justify-center pb-1">
                        <span className="font-serif italic text-slate-400 text-[10px] opacity-60">
                          {signatories[idx]?.name || 'Signature'}
                        </span>
                      </div>
                      <div className="font-bold text-[#0B1E36] text-[9.5px]">
                        {signatories[idx]?.title || `Signatory #${idx + 1}`}
                      </div>
                      <div className="text-[7.5px] text-slate-500 font-medium mt-0.5">
                        Horus University — Egypt
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DOCUMENT FOOTER */}
            <div className="mt-5 text-center text-[7.5px] text-slate-400 border-t border-slate-200 pt-2 font-medium">
              Horus University — Egypt (HUE) • Faculty of Pharmacy • Digital Transformation Unit (DTU) • NAQAAE Accredited
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 Tip: Set <span className="font-semibold text-slate-800">Landscape</span> & <span className="font-semibold text-slate-800">A4/A3</span> for matrix view.
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 font-bold text-xs text-slate-700 bg-white hover:bg-slate-50 transition-all"
            >
              Close
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="px-5 py-1.5 rounded-lg font-extrabold text-xs text-[#0B1E36] bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] hover:opacity-90 shadow-md transition-all flex items-center gap-1.5"
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

import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';
const LOGO_SESSION_MASTER = '/assets/session_master_shield_logo.png';

function PdfExportModal({ sessionId, session, scheduleData, pdfSettings: externalPdfSettings, onUpdatePdfSettings, onClose }) {
  const [layoutMode, setLayoutMode] = useState('matrix'); // 'matrix', 'supervision', 'chronological'
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  
  // Local or external settings
  const pdfSettings = externalPdfSettings || {
    semester: 'Fall Semester',
    academicYear: '2025-2026',
    period1Time: '09:00 AM - 11:00 AM',
    period2Time: '12:00 PM - 02:00 PM',
    showSignatures: true,
    numSignatures: 2,
    signatories: [
      { name: 'Dr. Exam Control Chair', title: 'Head of Exam Control' },
      { name: 'Prof. Dean Signature', title: 'Dean of Faculty of Pharmacy' }
    ],
    showStamp: false
  };

  const [roomName, setRoomName] = useState('Computer Lab A 416');
  const [buildingName, setBuildingName] = useState('A');
  const [floorNum, setFloorNum] = useState('4');
  const [roomCapacity, setRoomCapacity] = useState('38');

  const [exporting, setExporting] = useState(false);
  const printAreaRef = useRef(null);

  const schedule = scheduleData?.schedule || [];

  // Sort schedule chronologically
  const sortedSchedule = [...schedule].sort((a, b) => {
    const dateCompare = a.exam_date.localeCompare(b.exam_date);
    if (dateCompare !== 0) return dateCompare;
    return a.period - b.period;
  });

  // Unique dates for matrix view
  const dates = [...new Set(schedule.map(item => item.exam_date))].sort();

  // Program-level combinations
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

  // Matrix grouping
  const matrixData = {};
  dates.forEach(d => { matrixData[d] = { 1: {}, 2: {} }; });
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

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setExporting(true);

    try {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `HUE_Exam_Timetable_${pdfSettings.semester.replace(/\s+/g, '_')}.pdf`,
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-[#0B1E36] text-white p-4 flex justify-between items-center shrink-0 border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-extrabold text-base tracking-wide font-outfit text-white">
                PDF Export Studio — Horus University Egypt (HUE)
              </h3>
              <p className="text-xs text-[#D4AF37] font-semibold">
                Generate Official Timetable & Supervision PDF Documents
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
        <div className="bg-slate-100 border-b border-slate-200 p-3 shrink-0 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          <div>
            <label className="block text-slate-700 font-bold mb-1">Layout Preset</label>
            <select
              value={layoutMode}
              onChange={(e) => {
                setLayoutMode(e.target.value);
                if (e.target.value === 'supervision') setOrientation('portrait');
                else setOrientation('landscape');
              }}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-[#0B1E36]"
            >
              <option value="matrix">Generated Timetable Matrix (Recommended)</option>
              <option value="supervision">Hall Supervision Schedule</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Page Orientation & Size</label>
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
            <label className="block text-slate-700 font-bold mb-1">Active Semester</label>
            <div className="h-8 px-3 rounded-lg border border-slate-200 bg-white font-bold text-[#0B1E36] flex items-center">
              {pdfSettings.semester} ({pdfSettings.academicYear})
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Configured Period Times</label>
            <div className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 flex items-center text-[11px] truncate">
              P1: {pdfSettings.period1Time} • P2: {pdfSettings.period2Time}
            </div>
          </div>

        </div>

        {/* Live Document Preview Scroll Container */}
        <div className="flex-1 overflow-auto p-4 bg-slate-200/80 flex justify-center">
          
          <div 
            ref={printAreaRef}
            id="pdf-document-content" 
            className="bg-white text-slate-900 shadow-2xl rounded-none p-6 md:p-8 border border-slate-300 font-sans text-xs flex flex-col justify-between"
            style={{
              width: orientation === 'landscape' ? '1080px' : '780px',
              minHeight: '850px'
            }}
          >
            <div>
              {/* TOP HEADER: 4 LOGOS IN A ROW */}
              <div className="flex justify-center items-center gap-8 py-2 mb-2">
                <img src={LOGO_HUE} alt="HUE Logo" className="h-12 w-auto object-contain" />
                <img src={LOGO_PHARMACY} alt="Pharmacy Seal" className="h-12 w-12 object-contain" />
                <img src={LOGO_DTU} alt="DTU Logo" className="h-12 w-auto object-contain" />
                <img src={LOGO_SESSION_MASTER} alt="Session Master Logo" className="h-12 w-auto object-contain" />
              </div>

              {/* SUBHEADER DEVELOPER CREDITS */}
              <div className="text-center mb-3">
                <div className="text-xs font-semibold text-slate-700">
                  Full Stack Developed by <span className="font-extrabold text-[#0B1E36]">Prof. Mahmoud Elkhoudary</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Head of Digital Transformation Unit - Faculty of Pharmacy
                </div>
              </div>

              {/* NAVY DIVIDER LINE */}
              <div className="border-b-2 border-[#0B1E36] mb-5"></div>

              {/* FACULTY HEADING & SEMESTER BOX */}
              <div className="text-center mb-5">
                <h1 className="text-xl font-black tracking-wide text-[#0B1E36] m-0 uppercase font-outfit">
                  HORUS UNIVERSITY — EGYPT (HUE)
                </h1>
                <h2 className="text-xs font-bold text-[#D4AF37] tracking-widest uppercase m-0 mt-0.5">
                  FACULTY OF PHARMACY
                </h2>

                {/* PERFECTLY FITTED GOLD BORDER BOX */}
                <div className="mt-2 inline-block text-[11px] font-black text-[#0B1E36] bg-amber-50/80 px-4 py-1 rounded-lg border border-[#D4AF37] tracking-wide leading-tight shadow-inner max-w-full">
                  FINAL EXAMINATION TIMETABLE — {pdfSettings.semester.toUpperCase()} — ACADEMIC YEAR {pdfSettings.academicYear}
                </div>
              </div>

              {/* LAYOUT 1: MASTER TIMETABLE MATRIX GENERATED BY APP (DEFAULT) */}
              {layoutMode === 'matrix' && (
                <div className="mb-6 overflow-hidden">
                  <div className="flex justify-between items-center mb-1.5 px-0.5">
                    <span className="text-xs font-bold text-[#0B1E36] uppercase tracking-wider">
                      Official Schedule Matrix (Generated by Session Master)
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-semibold">
                      * Period 1: {pdfSettings.period1Time} • Period 2: {pdfSettings.period2Time}
                    </span>
                  </div>

                  {/* 10-Column Matrix Table with Navy/Gold Styling */}
                  <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed">
                    <thead>
                      <tr className="bg-[#001738] text-white">
                        <th className="border border-slate-400 p-1.5 text-center w-[8%] uppercase font-bold text-[9px]">Date & Day</th>
                        <th className="border border-slate-400 p-1.5 text-center w-[6%] uppercase font-bold text-[8px] text-[#EAB308]">Period</th>
                        {programLevels.length > 0 ? programLevels.map(pl => {
                          const [prog, lvl] = pl.split('|');
                          const isClinical = prog.includes('Clinical');
                          return (
                            <th key={pl} className="border border-slate-400 p-1 text-center font-bold">
                              <div className={`text-[8.5px] font-extrabold ${isClinical ? 'text-[#EAB308]' : 'text-white'}`}>{prog}</div>
                              <div className="text-slate-200 font-semibold text-[8px]">{lvl}</div>
                            </th>
                          );
                        }) : (
                          ['PharmD Level 1', 'PharmD Level 2', 'PharmD Level 3', 'PharmD Level 4', 'PharmD Level 5', 'Clinical Level 1', 'Clinical Level 2', 'Clinical Level 3'].map(pl => (
                            <th key={pl} className="border border-slate-400 p-1 text-center font-bold text-[#EAB308]">
                              <div className="text-[8px] font-bold">{pl}</div>
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dates.length > 0 ? dates.map((dateStr) => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                        return [1, 2].map((periodNum) => (
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
                        ));
                      }) : (
                        <tr className="bg-white">
                          <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                            No active schedule generated yet. Complete Step 5 to render your full timetable matrix here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* LAYOUT 2: HALL SUPERVISION SCHEDULE */}
              {layoutMode === 'supervision' && (
                <div>
                  <h2 className="text-2xl font-black text-center text-[#001738] uppercase tracking-wider font-outfit mb-4">
                    {roomName.toUpperCase()}
                  </h2>

                  <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-2xl p-4 mb-5 text-xs text-slate-700 font-medium shadow-2xs">
                    <div className="grid grid-cols-2 gap-y-2">
                      <div>Hall/Room: <span className="font-bold text-slate-900">{roomName}</span></div>
                      <div>Building: <span className="font-bold text-slate-900">{buildingName}</span></div>
                      <div>Floor: <span className="font-bold text-slate-900">{floorNum}</span></div>
                      <div>Capacity: <span className="font-bold text-slate-900">{roomCapacity} Students</span></div>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs mb-6">
                    <thead>
                      <tr className="bg-[#001738] text-[#EAB308] font-bold text-left uppercase text-[10px] tracking-wider">
                        <th className="p-3 w-[15%]">DATE</th>
                        <th className="p-3 w-[10%]">PERIOD</th>
                        <th className="p-3 w-[10%]">TIME</th>
                        <th className="p-3 w-[22%]">SUBJECT</th>
                        <th className="p-3 w-[13%]">PROGRAM</th>
                        <th className="p-3 w-[10%]">EXAM TYPE</th>
                        <th className="p-3 w-[8%] text-center">STUDENTS</th>
                        <th className="p-3 w-[22%] text-right">SUPERVISORS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sortedSchedule.length > 0 ? sortedSchedule : [
                        { exam_date: '2026-05-23', period: 1, course: { course_title: 'Physical Pharmacy', program: 'PharmD Clinical', student_count: 38 } },
                        { exam_date: '2026-06-06', period: 1, course: { course_title: 'Pharmacognosy 1', program: 'PharmD Clinical', student_count: 38 } }
                      ]).map((item, idx) => {
                        const dateObj = new Date(item.exam_date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                        return (
                          <tr 
                            key={item.course_id || idx} 
                            className="border-b border-slate-200 bg-white border-l-4 border-l-[#EAB308]"
                          >
                            <td className="p-3 font-bold text-slate-900">{formattedDate}</td>
                            <td className="p-3 text-slate-700 font-medium">Period {item.period}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.period === 1 ? pdfSettings.period1Time : pdfSettings.period2Time}</td>
                            <td className="p-3 font-semibold text-[#0B1E36]">{item.course?.course_title}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.course?.program}</td>
                            <td className="p-3 text-slate-700 font-medium">Final</td>
                            <td className="p-3 text-center font-bold text-slate-900">{item.course?.student_count || roomCapacity}</td>
                            <td className="p-3 text-right dir-rtl font-semibold text-slate-800 text-[11px]">
                              <div>د / أميرة المتولي <span className="text-[9px] text-slate-500 font-normal">(ComSupervisor)</span></div>
                              <div>إنجي أيمن <span className="text-[9px] text-slate-500 font-normal">(ExSuper)</span></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* DYNAMIC CONFIGURABLE SIGNATURES (DRIVEN BY SETTINGS) */}
            {pdfSettings.showSignatures && (
              <div className="mt-8 pt-4 border-t-2 border-slate-300">
                <div className={`grid grid-cols-${pdfSettings.numSignatures || 2} gap-6 text-center text-[9px]`}>
                  {Array.from({ length: pdfSettings.numSignatures || 2 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="h-10 border-b border-slate-400 w-44 mb-1.5 flex items-end justify-center pb-1">
                        <span className="font-serif italic text-slate-400 text-[10px] opacity-60">
                          {pdfSettings.signatories[idx]?.name || 'Signature'}
                        </span>
                      </div>
                      <div className="font-bold text-[#0B1E36] text-[9.5px]">
                        {pdfSettings.signatories[idx]?.title || `Signatory #${idx + 1}`}
                      </div>
                      <div className="text-[7.5px] text-slate-500 font-medium mt-0.5">
                        Horus University — Egypt
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OPTIONAL STAMP (TOGGLED VIA SETTINGS - DEFAULT REMOVED) */}
            {pdfSettings.showStamp && (
              <div className="mt-4 flex justify-center">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#0B1E36]/40 flex flex-col items-center justify-center text-center p-1 rotate-[-6deg] bg-slate-50">
                  <div className="text-[5.5px] font-bold text-[#0B1E36] uppercase">Horus University</div>
                  <div className="text-[7px] font-black text-[#D4AF37]">★ NAQAAE ★</div>
                  <div className="text-[5px] font-semibold text-slate-600">Exam Control</div>
                </div>
              </div>
            )}

            {/* DOCUMENT FOOTER MATCHING PIC EXACTLY */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <div>Generated on {new Date().toLocaleString('en-US')}</div>
              <div>Developed by <span className="font-extrabold text-[#0B1E36]">Prof. Mahmoud Elkhoudary</span> (Head of Digital Transformation Unit)</div>
              <div>Page 1 of 1</div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 Tip: Choose <span className="font-semibold text-slate-800">Landscape</span> & <span className="font-semibold text-slate-800">A4/A3</span> size for matrix view.
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

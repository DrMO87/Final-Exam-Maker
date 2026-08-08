import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';
const LOGO_SESSION_MASTER = '/assets/session_master_shield_logo.png';

function PdfExportModal({ sessionId, session, scheduleData, onClose }) {
  const [layoutMode, setLayoutMode] = useState('supervision'); // 'supervision', 'matrix', 'chronological'
  const [orientation, setOrientation] = useState('portrait'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  
  const [roomName, setRoomName] = useState('Computer Lab A 416');
  const [buildingName, setBuildingName] = useState('A');
  const [floorNum, setFloorNum] = useState('4');
  const [roomCapacity, setRoomCapacity] = useState('38');

  const [semester, setSemester] = useState(session?.semester || 'Fall Semester');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [period1Time, setPeriod1Time] = useState('10:00:00');
  const [period2Time, setPeriod2Time] = useState('12:30:00');
  
  const [showSignatures, setShowSignatures] = useState(true);
  const [numSignatures, setNumSignatures] = useState(2);
  const [signatories, setSignatories] = useState([
    { name: 'Dr. Exam Control Chair', title: 'Head of Exam Control' },
    { name: 'Prof. Dean Signature', title: 'Dean of Faculty of Pharmacy' }
  ]);

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
        filename: `${roomName.replace(/\s+/g, '_')}_Schedule.pdf`,
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
                Generate Official Supervision & Timetable PDF Documents
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
        <div className="bg-slate-100 border-b border-slate-200 p-3 shrink-0 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          
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
              <option value="supervision">Hall Supervision Schedule (Pic Format)</option>
              <option value="matrix">Master Timetable Matrix</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Page Format</label>
            <div className="flex gap-1">
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
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
            <label className="block text-slate-700 font-bold mb-1">Hall / Room Title</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Building & Floor</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="Bldg A"
                className="w-1/2 h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              />
              <input
                type="text"
                value={floorNum}
                onChange={(e) => setFloorNum(e.target.value)}
                placeholder="Floor 4"
                className="w-1/2 h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Capacity Students</label>
            <input
              type="text"
              value={roomCapacity}
              onChange={(e) => setRoomCapacity(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
            />
          </div>

        </div>

        {/* Live Document Preview Scroll Container */}
        <div className="flex-1 overflow-auto p-4 bg-slate-200/80 flex justify-center">
          
          <div 
            ref={printAreaRef}
            id="pdf-document-content" 
            className="bg-white text-slate-900 shadow-2xl rounded-none p-8 border border-slate-300 font-sans text-xs flex flex-col justify-between"
            style={{
              width: orientation === 'landscape' ? '1050px' : '780px',
              minHeight: '980px'
            }}
          >
            <div>
              {/* LAYOUT 1: ROOM SUPERVISION SCHEDULE (MATCHING USER IMAGE 100%) */}
              {layoutMode === 'supervision' && (
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
                  <div className="border-b-2 border-[#0B1E36] mb-6"></div>

                  {/* ROOM HEADING */}
                  <h1 className="text-3xl font-black text-center text-[#001738] uppercase tracking-wider font-outfit mb-5">
                    {roomName.toUpperCase()}
                  </h1>

                  {/* ROOM INFO SUMMARY BOX */}
                  <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-2xl p-4 mb-6 text-xs text-slate-700 font-medium shadow-2xs">
                    <div className="grid grid-cols-2 gap-y-2">
                      <div>Hall/Room: <span className="font-bold text-slate-900">{roomName}</span></div>
                      <div>Building: <span className="font-bold text-slate-900">{buildingName}</span></div>
                      <div>Floor: <span className="font-bold text-slate-900">{floorNum}</span></div>
                      <div>Capacity: <span className="font-bold text-slate-900">{roomCapacity} Students</span></div>
                    </div>
                  </div>

                  {/* SUPERVISION TABLE */}
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
                        { exam_date: '2026-06-06', period: 1, course: { course_title: 'Pharmacognosy 1', program: 'PharmD Clinical', student_count: 38 } },
                        { exam_date: '2026-06-16', period: 1, course: { course_title: 'Histology', program: 'PharmD Clinical', student_count: 38 } },
                        { exam_date: '2026-06-25', period: 1, course: { course_title: 'Medicinal Chemistry (1)', program: 'PharmD Clinical', student_count: 38 } }
                      ]).map((item, idx) => {
                        const dateObj = new Date(item.exam_date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        const timeStr = item.period === 1 ? '10:00:00' : '12:30:00';

                        return (
                          <tr 
                            key={item.course_id || idx} 
                            className="border-b border-slate-200 bg-white hover:bg-slate-50/80 transition-colors border-l-4 border-l-[#EAB308]"
                          >
                            <td className="p-3 font-bold text-slate-900">{formattedDate}</td>
                            <td className="p-3 text-slate-700 font-medium">Period {item.period}</td>
                            <td className="p-3 text-slate-700 font-medium">{timeStr}</td>
                            <td className="p-3 font-semibold text-[#0B1E36]">{item.course?.course_title}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.course?.program}</td>
                            <td className="p-3 text-slate-700 font-medium">Final</td>
                            <td className="p-3 text-center font-bold text-slate-900">{item.course?.student_count || roomCapacity}</td>
                            <td className="p-3 text-right dir-rtl font-semibold text-slate-800 leading-relaxed text-[11px]">
                              <div>د / أميرة المتولي <span className="text-[9px] text-slate-500 font-normal">(ComSupervisor)</span></div>
                              <div>إنجي أيمن <span className="text-[9px] text-slate-500 font-normal">(ExSuper)</span></div>
                              <div>دينا الحسيني <span className="text-[9px] text-slate-500 font-normal">(Inv)</span></div>
                              <div>رحمه البابلي <span className="text-[9px] text-slate-500 font-normal">(Inv)</span></div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                </div>
              )}

              {/* LAYOUT 2: TIMETABLE MATRIX GRID */}
              {layoutMode === 'matrix' && (
                <div>
                  <div className="bg-[#0B1E36] text-white p-4 rounded-lg border-b-4 border-[#D4AF37] relative overflow-hidden mb-4">
                    <div className="flex justify-between items-center relative z-10 gap-2">
                      <div className="flex items-center bg-white p-1.5 rounded-md shadow-md border border-slate-200 shrink-0">
                        <img src={LOGO_HUE} alt="Horus University Egypt Logo" className="h-12 w-auto object-contain" />
                      </div>
                      <div className="text-center flex-1 px-2">
                        <h1 className="text-lg font-black tracking-wide text-white m-0 uppercase font-outfit">
                          HORUS UNIVERSITY — EGYPT (HUE)
                        </h1>
                        <h2 className="text-xs font-bold text-[#D4AF37] tracking-widest uppercase m-0 mt-0.5">
                          FACULTY OF PHARMACY
                        </h2>
                        <div className="mt-2 inline-block text-[11px] font-black text-white bg-white/10 px-4 py-1 rounded-lg border border-[#D4AF37] tracking-wide leading-tight shadow-inner max-w-full">
                          FINAL EXAMINATION TIMETABLE — {semester.toUpperCase()} — ACADEMIC YEAR {academicYear}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <img src={LOGO_PHARMACY} alt="Faculty of Pharmacy Seal" className="h-12 w-12 object-contain bg-white p-1 rounded-full shadow-md" />
                        <img src={LOGO_DTU} alt="DTU Logo" className="h-12 w-auto object-contain bg-white p-1 rounded-md shadow-md" />
                      </div>
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed mb-4">
                    <thead>
                      <tr className="bg-[#0B1E36] text-white">
                        <th className="border border-slate-400 p-1.5 text-center w-[8%] uppercase font-bold text-[9px]">Date</th>
                        <th className="border border-slate-400 p-1.5 text-center w-[6%] uppercase font-bold text-[8px]">Period</th>
                        {programLevels.map(pl => {
                          const [prog, lvl] = pl.split('|');
                          return (
                            <th key={pl} className="border border-slate-400 p-1 text-center font-bold">
                              <div className="text-[8.5px] font-extrabold text-[#D4AF37]">{prog}</div>
                              <div className="text-slate-200 text-[8px]">{lvl}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {dates.map((dateStr) => {
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                        return [1, 2].map((periodNum) => (
                          <tr key={`${dateStr}-${periodNum}`} className="bg-white border-b border-slate-300">
                            {periodNum === 1 && (
                              <td rowSpan={2} className="border border-slate-300 p-1 text-center align-middle font-bold bg-slate-100">
                                <div>{dayName}</div>
                                <div className="text-[8px] text-slate-500">{dateStr}</div>
                              </td>
                            )}
                            <td className="border border-slate-300 p-0.5 text-center font-bold text-slate-700 bg-slate-50">
                              P{periodNum}
                            </td>
                            {programLevels.map(pl => {
                              const assignedItems = matrixData[dateStr]?.[periodNum]?.[pl] || [];
                              return (
                                <td key={pl} className="border border-slate-300 p-1 align-top">
                                  {assignedItems.map(item => (
                                    <div key={item.course_id} className="bg-slate-50 rounded p-1 mb-1 border border-slate-200">
                                      <div className="font-bold text-[#0B1E36] text-[8.5px]">{item.course.course_code}</div>
                                      <div className="text-[7.5px] text-slate-700">{item.course.course_title}</div>
                                    </div>
                                  ))}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* DOCUMENT FOOTER MATCHING PIC EXACTLY */}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
              <div>Generated on {new Date().toLocaleString('en-US')}</div>
              <div>Developed by <span className="font-extrabold text-[#0B1E36]">Prof. Mahmoud Elkhoudary</span> (Head of Digital Transformation Unit)</div>
              <div>Page 1 of 1</div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 Tip: Choose <span className="font-semibold text-slate-800">Hall Supervision Schedule</span> to export in exact reference image format.
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

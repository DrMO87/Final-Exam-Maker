import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';
const LOGO_SESSION_MASTER = '/assets/session_master_shield_logo.png';

function PdfExportModal({ sessionId, session, scheduleData, pdfSettings: externalPdfSettings, onUpdatePdfSettings, onClose }) {
  const [layoutMode, setLayoutMode] = useState('matrix'); // 'matrix', 'supervision'
  const [matrixColumnMode, setMatrixColumnMode] = useState('detailed'); // 'detailed' (10 Program Columns), 'unified' (5 Level Columns)
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  const [zoomLevel, setZoomLevel] = useState(100); // 80, 90, 100, 110, 120

  // Local or external settings state with fallback
  const [localSettings, setLocalSettings] = useState(() => {
    if (externalPdfSettings) return externalPdfSettings;
    try {
      const saved = localStorage.getItem('hue_pdf_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
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
  });

  // Keep external state in sync if provided
  const pdfSettings = externalPdfSettings || localSettings;

  const updateSetting = (key, val) => {
    const updated = { ...pdfSettings, [key]: val };
    setLocalSettings(updated);
    if (onUpdatePdfSettings) {
      onUpdatePdfSettings(updated);
    }
  };

  const [exporting, setExporting] = useState(false);
  const printAreaRef = useRef(null);

  const schedule = scheduleData?.schedule || [];

  // Helper to normalize flat vs nested course objects safely (FIX BUG 5)
  const getCourseInfo = (item) => {
    if (!item) return { course_code: '', course_title: '', program: '', level: 1, student_count: 0, has_oral_exam: false };
    const c = item.course || item;
    return {
      course_code: c.course_code || item.course_code || '',
      course_title: c.course_title || item.course_title || '',
      program: c.program || item.program || 'PharmD',
      level: Number(c.level || item.level) || 1,
      student_count: Number(c.student_count || item.student_count) || 0,
      has_oral_exam: Boolean(c.has_oral_exam || item.has_oral_exam),
      course_id: c.id || item.course_id || item.id
    };
  };

  // Sort schedule chronologically
  const sortedSchedule = [...schedule].sort((a, b) => {
    const dateCompare = (a.exam_date || '').localeCompare(b.exam_date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.period || 1) - (b.period || 1);
  });

  // Unique dates for matrix view
  const dates = [...new Set(schedule.map(item => item.exam_date).filter(Boolean))].sort();

  // Program-level combinations
  const programLevelSet = new Set();
  schedule.forEach(item => {
    const c = getCourseInfo(item);
    if (c.course_code) {
      programLevelSet.add(`${c.program}|Level ${c.level}`);
    }
  });
  
  const defaultProgramLevels = [
    'PharmD|Level 1', 'PharmD Clinical|Level 1',
    'PharmD|Level 2', 'PharmD Clinical|Level 2',
    'PharmD|Level 3', 'PharmD Clinical|Level 3',
    'PharmD|Level 4', 'PharmD Clinical|Level 4',
    'PharmD|Level 5', 'PharmD Clinical|Level 5'
  ];

  const programLevels = programLevelSet.size > 0 
    ? [...programLevelSet].sort((a, b) => {
        const [progA, lvlStrA] = a.split('|Level ');
        const [progB, lvlStrB] = b.split('|Level ');
        const lvlA = Number(lvlStrA) || 0;
        const lvlB = Number(lvlStrB) || 0;
        if (lvlA !== lvlB) return lvlA - lvlB;
        return progA.localeCompare(progB);
      })
    : defaultProgramLevels;

  const unifiedLevels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

  const columnsToUse = matrixColumnMode === 'unified' ? unifiedLevels : programLevels;

  // Matrix grouping
  const matrixData = {};
  dates.forEach(d => { matrixData[d] = { 1: {}, 2: {} }; });
  schedule.forEach(item => {
    const c = getCourseInfo(item);
    if (!c.course_code || !item.exam_date) return;

    const plKey = matrixColumnMode === 'unified' 
      ? `Level ${c.level}` 
      : `${c.program}|Level ${c.level}`;

    const period = item.period || 1;
    if (matrixData[item.exam_date] && matrixData[item.exam_date][period]) {
      if (!matrixData[item.exam_date][period][plKey]) {
        matrixData[item.exam_date][period][plKey] = [];
      }
      matrixData[item.exam_date][period][plKey].push({ ...item, courseObj: c });
    }
  });

  const handleDownloadPdf = () => {
    setExporting(true);
    try {
      window.print();
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setTimeout(() => setExporting(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-[#002147] text-white p-4 flex justify-between items-center shrink-0 border-b border-[#FFB81C]/40">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-extrabold text-base tracking-wide font-outfit text-white">
                Official Examination Timetable — Horus University Egypt (HUE)
              </h3>
              <p className="text-xs text-[#FFB81C] font-semibold">
                Export & Print Official Faculty Examination Timetable
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

        {/* Configuration Controls Bar */}
        <div className="bg-slate-100 border-b border-slate-200 p-3 shrink-0 space-y-3 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            
            {/* Matrix Column Format */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Column Format</label>
              <select
                value={matrixColumnMode}
                onChange={(e) => setMatrixColumnMode(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-[#002147]"
              >
                <option value="detailed">10 Program Levels (Detailed)</option>
                <option value="unified">Unified 5 Levels (Wider Cards)</option>
              </select>
            </div>

            {/* Page Orientation & Size */}
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

            {/* Document Options Toggles */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Document Extras</label>
              <div className="flex items-center gap-2 h-8">
                <button
                  type="button"
                  onClick={() => updateSetting('showSignatures', !pdfSettings.showSignatures)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    pdfSettings.showSignatures ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white border-slate-300 text-slate-500'
                  }`}
                >
                  {pdfSettings.showSignatures ? '✍️ Signatures: ON' : '✍️ Signatures: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('showStamp', !pdfSettings.showStamp)}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                    pdfSettings.showStamp ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-300 text-slate-500'
                  }`}
                >
                  {pdfSettings.showStamp ? '🔴 Final Stamp: ON' : '🔴 Final Stamp: OFF'}
                </button>
              </div>
            </div>

            {/* Zoom / Scaling Control */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Preview Zoom ({zoomLevel}%)</label>
              <div className="flex items-center gap-1 h-8">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(60, prev - 10))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  ➖
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="px-2 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 text-[11px]"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                >
                  ➕
                </button>
              </div>
            </div>

            {/* Active Semester Info */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Active Semester</label>
              <div className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-[#002147] flex items-center text-[11px] truncate">
                {pdfSettings.semester} ({pdfSettings.academicYear})
              </div>
            </div>

          </div>

        </div>

        {/* Live Document Preview Scroll Container */}
        <div className="flex-1 overflow-auto p-4 bg-slate-200/80 flex justify-center items-start">
          
          <div 
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease'
            }}
          >
            <div 
              ref={printAreaRef}
              id="pdf-document-content" 
              className="bg-white text-slate-900 shadow-2xl rounded-none p-3 sm:p-4 border border-slate-300 font-sans text-xs flex flex-col justify-between"
              style={{
                width: orientation === 'landscape' ? '1280px' : '920px',
                minHeight: '800px',
                boxSizing: 'border-box'
              }}
            >
              {/* PRINT CSS TO FORCE TABLE HEADER REPETITION & REFINED MARGINS */}
              <style>{`
                @media print {
                  @page { margin: 3mm; }
                  thead { display: table-header-group !important; }
                  tr { page-break-inside: avoid !important; }
                }
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; }
              `}</style>

              <div>
                {/* TOP BRANDING HEADER MATCHING REPORT_BRANDING */}
                <div className="border-b-2 border-[#002147] pb-3 mb-4">
                  <div className="flex justify-center items-center gap-8 mb-2">
                    <img src={LOGO_HUE} alt="HUE Logo" className="h-14 w-auto object-contain" />
                    <img src={LOGO_PHARMACY} alt="Pharmacy Seal" className="h-14 w-14 object-contain" />
                    <img src={LOGO_DTU} alt="DTU Logo" className="h-14 w-auto object-contain" />
                    <img src={LOGO_SESSION_MASTER} alt="Session Master Logo" className="h-14 w-auto object-contain" />
                  </div>

                  <div className="text-center">
                    <div className="text-xs font-semibold text-slate-600">
                      Full Stack Developed by <span className="font-bold text-[#002147]">Prof. Mahmoud Elkhoudary</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Head of Digital Transformation Unit - Faculty of Pharmacy
                    </div>
                  </div>
                </div>

                {/* DOCUMENT HEADING & REPORT META CONTAINER */}
                <div className="text-center mb-4">
                  <h1 className="text-2xl font-black tracking-wide text-[#002147] m-0 uppercase font-outfit">
                    HORUS UNIVERSITY — EGYPT (HUE)
                  </h1>
                  <h2 className="text-xs font-bold text-[#FFB81C] tracking-widest uppercase m-0 mt-0.5">
                    FACULTY OF PHARMACY
                  </h2>

                  <div className="mt-2.5 bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-xl max-w-2xl mx-auto shadow-2xs">
                    <div className="font-extrabold text-[#002147] text-xs uppercase tracking-wider">
                      FINAL EXAMINATION TIMETABLE — {(pdfSettings.semester || 'SEMESTER').toUpperCase()} — ACADEMIC YEAR {pdfSettings.academicYear}
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-1">
                      Period 1: <span className="font-bold text-slate-800">{pdfSettings.period1Time}</span> • Period 2: <span className="font-bold text-slate-800">{pdfSettings.period2Time}</span>
                    </div>
                  </div>
                </div>

                {/* MASTER TIMETABLE MATRIX */}
                <div className="mb-4 overflow-hidden">
                    
                    {/* Matrix Table with Navy/Gold Styling */}
                    <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed">
                      <thead className="bg-[#002147] text-white">
                        <tr className="bg-[#002147] text-white">
                          <th className="border border-slate-400 p-1.5 text-center w-[8.5%] uppercase font-bold text-[8.5px] text-[#FFB81C] border-l-4 border-l-[#FFB81C]">
                            Date & Day
                          </th>
                          <th className="border border-slate-400 p-1.5 text-center w-[5.5%] uppercase font-bold text-[8px] text-[#FFB81C]">
                            Period
                          </th>
                          {columnsToUse.map(colKey => {
                            if (matrixColumnMode === 'unified') {
                              return (
                                <th key={colKey} className="border border-slate-400 p-1.5 text-center font-bold bg-[#002147] text-white">
                                  <div className="text-[9.5px] font-black text-[#FFB81C] uppercase tracking-wider">{colKey}</div>
                                  <div className="text-slate-300 font-medium text-[7.5px]">PharmD & Clinical</div>
                                </th>
                              );
                            }
                            const [prog, lvl] = colKey.split('|');
                            const isClinical = prog.toLowerCase().includes('clinical');
                            return (
                              <th key={colKey} className="border border-slate-400 p-1 text-center font-bold bg-[#002147]">
                                <div className={`text-[8px] font-black leading-tight ${isClinical ? 'text-[#FFB81C]' : 'text-white'}`}>{prog}</div>
                                <div className="text-slate-200 font-bold text-[8px]">{lvl}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {dates.length > 0 ? dates.map((dateStr) => {
                          const dateObj = new Date(dateStr + 'T00:00:00');
                          const dayName = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const formattedDate = isNaN(dateObj.getTime()) ? dateStr : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                          return [1, 2].map((periodNum) => (
                            <tr 
                              key={`${dateStr}-${periodNum}`} 
                              className={periodNum === 2 ? 'border-b-2 border-slate-400 break-inside-avoid' : 'border-b border-slate-200 break-inside-avoid'}
                            >
                              {periodNum === 1 && (
                                <td 
                                  rowSpan={2} 
                                  style={{ backgroundColor: '#f8fafc', position: 'relative', zIndex: 10 }}
                                  className="border border-slate-300 p-1 text-center align-middle font-bold bg-[#F8FAFC] border-l-4 border-l-[#FFB81C] leading-tight"
                                >
                                  <div className="flex flex-col items-center justify-center h-full py-1">
                                    <div className="text-[10px] text-[#002147] font-extrabold">{dayName}</div>
                                    <div className="text-[7.5px] text-slate-600 font-bold mt-0.5 whitespace-nowrap">{formattedDate}</div>
                                  </div>
                                </td>
                              )}

                              <td 
                                style={{ backgroundColor: '#ffffff' }}
                                className="border border-slate-300 p-0.5 text-center font-bold align-middle bg-white"
                              >
                                <span className={`inline-block px-1 py-0.5 rounded text-[7.5px] font-bold ${periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                  P{periodNum}
                                </span>
                              </td>

                              {columnsToUse.map(colKey => {
                                const assignedItems = matrixData[dateStr]?.[periodNum]?.[colKey] || [];

                                return (
                                  <td 
                                    key={colKey} 
                                    style={{ backgroundColor: '#ffffff' }}
                                    className="border border-slate-300 p-0.5 align-top bg-white"
                                  >
                                    {assignedItems.length > 0 ? (
                                      <div className="space-y-1">
                                        {assignedItems.map(item => {
                                          const c = item.courseObj || getCourseInfo(item);
                                          const isClinical = c.program.toLowerCase().includes('clinical');
                                          return (
                                            <div 
                                              key={c.course_id || c.course_code} 
                                              className="bg-white rounded border border-slate-300 p-1 shadow-2xs break-inside-avoid"
                                              style={{ wordBreak: 'break-word', overflowWrap: 'break-word', marginBottom: '3px' }}
                                            >
                                              {/* Card Header: Course Code + Dead-Centered Student Count Badge */}
                                              <div 
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  justifyContent: 'space-between', 
                                                  borderBottom: '1px solid #e2e8f0', 
                                                  paddingBottom: '2px', 
                                                  marginBottom: '3px',
                                                  width: '100%'
                                                }}
                                              >
                                                <span 
                                                  style={{ 
                                                    fontSize: '8.5px', 
                                                    fontWeight: '900', 
                                                    color: '#002147', 
                                                    lineHeight: '12px', 
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                  }}
                                                >
                                                  {c.course_code}
                                                </span>
                                                
                                                <span 
                                                  style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    height: '13px', 
                                                    padding: '0 4px', 
                                                    fontSize: '7px', 
                                                    fontWeight: '800', 
                                                    lineHeight: '13px', 
                                                    color: '#1e293b', 
                                                    backgroundColor: '#f1f5f9', 
                                                    border: '1px solid #cbd5e1', 
                                                    borderRadius: '3px',
                                                    flexShrink: 0
                                                  }}
                                                >
                                                  {c.student_count}
                                                </span>
                                              </div>
                                              
                                              {matrixColumnMode === 'unified' && (
                                                <div className="mb-1">
                                                  <span className={`text-[6.5px] font-bold px-1 py-0.5 rounded border ${
                                                    isClinical ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-blue-50 text-blue-900 border-blue-200'
                                                  }`}>
                                                    {c.program}
                                                  </span>
                                                </div>
                                              )}

                                              {/* Course Title */}
                                              <div 
                                                style={{ 
                                                  fontSize: '7.5px', 
                                                  fontWeight: '700', 
                                                  color: '#0f172a', 
                                                  lineHeight: '1.2', 
                                                  marginTop: '2px', 
                                                  wordBreak: 'break-word',
                                                  textAlign: 'left'
                                                }}
                                              >
                                                {c.course_title}
                                              </div>

                                              {/* Oral Exam Badge */}
                                              {c.has_oral_exam && (
                                                <div 
                                                  style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    gap: '2px', 
                                                    height: '13px', 
                                                    padding: '0 4px', 
                                                    fontSize: '6.5px', 
                                                    fontWeight: '800', 
                                                    lineHeight: '13px', 
                                                    color: '#78350f', 
                                                    backgroundColor: '#fef3c7', 
                                                    border: '1px solid #fcd34d', 
                                                    borderRadius: '9999px', 
                                                    marginTop: '3px' 
                                                  }}
                                                >
                                                  🎤 Oral
                                                </div>
                                              )}
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
                </div>

              {/* DYNAMIC CONFIGURABLE SIGNATURES - FIX BUG 1 (Tailwind Dynamic Class) */}
              {pdfSettings.showSignatures && (
                <div className="mt-8 pt-4 border-t-2 border-slate-300 break-inside-avoid">
                  <div 
                    className="grid gap-6 text-center text-[9px]"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${pdfSettings.numSignatures || 2}, minmax(0, 1fr))`
                    }}
                  >
                    {Array.from({ length: pdfSettings.numSignatures || 2 }).map((_, idx) => {
                      const sig = pdfSettings.signatories?.[idx] || {};
                      return (
                        <div key={idx} className="flex flex-col items-center">
                          <div className="h-10 border-b border-slate-400 w-44 mb-1.5 flex items-end justify-center pb-1">
                            <span className="font-serif italic text-slate-300 text-[9px] opacity-40">
                              (Signature)
                            </span>
                          </div>
                          <div className="font-extrabold text-[#002147] text-[10px]">
                            {sig.name || `Signatory #${idx + 1}`}
                          </div>
                          <div className="text-[8.5px] text-slate-600 font-semibold mt-0.5">
                            {sig.title || 'Official Title'}
                          </div>
                          <div className="text-[7.5px] text-slate-400 font-medium mt-0.5">
                            Horus University — Egypt
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* OPTIONAL STAMP - Tilted Red Rectangular Rubber Stamp */}
              {pdfSettings.showStamp && (
                <div className="mt-4 flex justify-center break-inside-avoid select-none">
                  <div className="relative transform rotate-[-12deg] transition-transform duration-200">
                    <div className="border-2 border-red-600 rounded-sm p-1.5 px-5 text-center bg-red-50/40 shadow-xs border-dashed outline outline-1 outline-offset-2 outline-red-600">
                      <div className="text-[7px] font-extrabold uppercase tracking-widest text-red-700 leading-tight">
                        Horus University Egypt
                      </div>
                      <div className="text-xs font-black uppercase tracking-widest text-red-600 my-0.5 border-y border-red-600/50 py-0.5 px-2">
                        ★ FINAL VERSION ★
                      </div>
                      <div className="text-[6.5px] font-bold uppercase tracking-wider text-red-700 leading-tight">
                        Exam Control Committee • Approved
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENT FOOTER */}
              <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium break-inside-avoid">
                <div>Generated on {new Date().toLocaleString('en-US')}</div>
                <div>Developed by <span className="font-bold text-[#002147]">Prof. Mahmoud Elkhoudary</span> (Head of Digital Transformation Unit)</div>
                <div>Horus University Egypt</div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 Tip: Select <span className="font-semibold text-slate-800">Landscape</span> orientation for clean timetable matrix layout.
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn btn-secondary btn-sm font-semibold"
            >
              🖨️ Browser Print
            </button>

            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm font-bold"
            >
              Close
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="btn btn-gold btn-sm font-extrabold shadow-md flex items-center gap-1.5"
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

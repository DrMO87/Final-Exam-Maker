import { useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';
const LOGO_SESSION_MASTER = '/assets/session_master_shield_logo.png';

function PdfExportModal({ sessionId, session, scheduleData, pdfSettings: externalPdfSettings, onUpdatePdfSettings, onClose }) {
  const [layoutMode, setLayoutMode] = useState('matrix'); // 'matrix', 'supervision'
  const [matrixColumnMode, setMatrixColumnMode] = useState('detailed'); // 'detailed' (10 Program Columns), 'unified' (5 Level Columns)
  const [programFilter, setProgramFilter] = useState('all'); // 'all', 'PharmD', 'PharmD Clinical', etc.
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', '1', '2', '3', '4', '5'
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' or 'portrait'
  const [pageSize, setPageSize] = useState('a4'); // 'a4' or 'a3'
  const [zoomLevel, setZoomLevel] = useState(100); // Default 100% (Fits 1060px A4 Landscape Margins)

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

  // Extract all unique available programs from schedule
  const availablePrograms = [...new Set([
    'PharmD',
    'PharmD Clinical',
    ...schedule.map(item => getCourseInfo(item).program).filter(Boolean)
  ])].sort();

  // Filter schedule based on program and level selections
  const filteredSchedule = schedule.filter(item => {
    const c = getCourseInfo(item);
    if (!c.course_code || !item.exam_date) return false;

    if (programFilter !== 'all') {
      if (c.program.trim().toLowerCase() !== programFilter.trim().toLowerCase()) return false;
    }

    if (levelFilter !== 'all') {
      if (String(c.level) !== String(levelFilter)) return false;
    }

    return true;
  });

  // Unique dates for matrix view based on active filtered schedule items
  const activeDates = [...new Set(filteredSchedule.map(item => item.exam_date).filter(Boolean))].sort();
  const dates = activeDates.length > 0 
    ? activeDates 
    : [...new Set(schedule.map(item => item.exam_date).filter(Boolean))].sort();

  const defaultProgramLevels = [
    'PharmD|Level 1', 'PharmD Clinical|Level 1',
    'PharmD|Level 2', 'PharmD Clinical|Level 2',
    'PharmD|Level 3', 'PharmD Clinical|Level 3',
    'PharmD|Level 4', 'PharmD Clinical|Level 4',
    'PharmD|Level 5', 'PharmD Clinical|Level 5'
  ];

  // Program-level combinations (always include all 10 official faculty columns L1-L5)
  const programLevelSet = new Set(defaultProgramLevels);
  schedule.forEach(item => {
    const c = getCourseInfo(item);
    if (c.course_code && c.program && c.level) {
      programLevelSet.add(`${c.program}|Level ${c.level}`);
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

  const unifiedLevels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

  let columns = matrixColumnMode === 'unified' ? unifiedLevels : programLevels;

  // Filter columns by Program (only in detailed mode)
  if (programFilter !== 'all' && matrixColumnMode !== 'unified') {
    columns = columns.filter(colKey => {
      const [prog] = colKey.split('|');
      return prog.trim().toLowerCase() === programFilter.trim().toLowerCase();
    });
  }

  // Filter columns by Level
  if (levelFilter !== 'all') {
    columns = columns.filter(colKey => {
      if (matrixColumnMode === 'unified') {
        return colKey === `Level ${levelFilter}`;
      } else {
        const [_, lvlStr] = colKey.split('|Level ');
        return String(lvlStr).trim() === String(levelFilter).trim();
      }
    });
  }

  const columnsToUse = columns.length > 0 ? columns : (matrixColumnMode === 'unified' ? unifiedLevels : programLevels);

  // Matrix grouping using filtered schedule items
  const matrixData = {};
  dates.forEach(d => { matrixData[d] = { 1: {}, 2: {} }; });
  filteredSchedule.forEach(item => {
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

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setExporting(true);

    try {
      const element = printAreaRef.current;
      
      // Clone element off-screen for pristine rendering without modal scrollbar distortion
      const clone = element.cloneNode(true);
      const targetWidth = orientation === 'landscape' ? '1060px' : '760px';
      clone.style.width = targetWidth;
      clone.style.maxWidth = targetWidth;
      clone.style.transform = 'none';
      clone.style.padding = '8px';
      clone.style.boxSizing = 'border-box';
      clone.style.background = '#ffffff';

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = targetWidth;
      container.appendChild(clone);
      document.body.appendChild(container);

      const progSuffix = programFilter !== 'all' ? `_${programFilter.replace(/\s+/g, '')}` : '';
      const lvlSuffix = levelFilter !== 'all' ? `_Level${levelFilter}` : '';

      const opt = {
        margin: [3, 3, 3, 3],
        filename: `HUE_Exam_Timetable_${(pdfSettings.semester || 'Semester').replace(/\s+/g, '_')}${progSuffix}${lvlSuffix}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: orientation === 'landscape' ? 1060 : 760
        },
        jsPDF: { unit: 'mm', format: pageSize, orientation: orientation },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt).from(clone).save();
      document.body.removeChild(container);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        
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
        <div className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-3 shrink-0 space-y-3 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5">
            
            {/* Filter by Program Scope */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Program Scope</label>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-[#002147] text-[11px]"
              >
                <option value="all">🎓 All Programs (Master)</option>
                {availablePrograms.map(prog => (
                  <option key={prog} value={prog}>📚 {prog} Only</option>
                ))}
              </select>
            </div>

            {/* Filter by Level Scope */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Level Scope</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-[#002147] text-[11px]"
              >
                <option value="all">📊 All Levels</option>
                <option value="1">Level 1 Only</option>
                <option value="2">Level 2 Only</option>
                <option value="3">Level 3 Only</option>
                <option value="4">Level 4 Only</option>
                <option value="5">Level 5 Only</option>
              </select>
            </div>

            {/* Matrix Column Format */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Column Format</label>
              <select
                value={matrixColumnMode}
                onChange={(e) => setMatrixColumnMode(e.target.value)}
                className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-[#002147] text-[11px]"
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
                  className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 text-[11px]"
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className="w-1/2 h-8 px-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 text-[11px]"
                >
                  <option value="a4">A4</option>
                  <option value="a3">A3</option>
                </select>
              </div>
            </div>

            {/* Document Options Toggles */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Document Extras</label>
              <div className="flex items-center gap-1.5 h-8">
                <button
                  type="button"
                  onClick={() => updateSetting('showSignatures', !pdfSettings.showSignatures)}
                  className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition-all ${
                    pdfSettings.showSignatures ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white border-slate-300 text-slate-500'
                  }`}
                >
                  {pdfSettings.showSignatures ? '✍️ Signatures: ON' : '✍️ Off'}
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('showStamp', !pdfSettings.showStamp)}
                  className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition-all ${
                    pdfSettings.showStamp ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-slate-300 text-slate-500'
                  }`}
                >
                  {pdfSettings.showStamp ? '🔴 Stamp: ON' : '🔴 Off'}
                </button>
              </div>
            </div>

            {/* Zoom / Scaling Control */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Preview Zoom ({zoomLevel}%)</label>
              <div className="flex items-center gap-1 h-8">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="w-7 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
                  title="Zoom Out"
                >
                  ➖
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(85)}
                  className={`px-1.5 h-8 rounded-lg border font-bold text-[10px] transition-colors ${
                    zoomLevel === 85 ? 'bg-[#002147] text-white border-[#002147]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Fit Table to Page Margins"
                >
                  Fit 85%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className={`px-1.5 h-8 rounded-lg border font-semibold text-[10px] transition-colors ${
                    zoomLevel === 100 ? 'bg-[#002147] text-white border-[#002147]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="w-7 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs"
                  title="Zoom In"
                >
                  ➕
                </button>
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
                width: orientation === 'landscape' ? '1060px' : '760px',
                minHeight: '800px',
                boxSizing: 'border-box'
              }}
            >
              {/* PRINT CSS TO FORCE TABLE HEADER REPETITION & REFINED MARGINS */}
              <style>{`
                @media print {
                  @page { size: A4 landscape; margin: 4mm; }
                  body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  #pdf-document-content {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    transform: none !important;
                  }
                  thead { display: table-header-group !important; }
                  tr { page-break-inside: avoid !important; }
                  table { table-layout: fixed !important; width: 100% !important; }
                }
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; }
              `}</style>

              <div>
                {/* TOP BRANDING HEADER MATCHING REPORT_BRANDING */}
                <div className="border-b-2 border-[#002147] pb-3 mb-4">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginBottom: '8px' }}>
                    <img src={LOGO_HUE} alt="HUE Logo" height="42" style={{ height: '42px', maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
                    <img src={LOGO_PHARMACY} alt="Pharmacy Seal" height="42" style={{ height: '42px', maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
                    <img src={LOGO_DTU} alt="DTU Logo" height="42" style={{ height: '42px', maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
                    <img src={LOGO_SESSION_MASTER} alt="Session Master Logo" height="42" style={{ height: '42px', maxHeight: '42px', width: 'auto', objectFit: 'contain' }} />
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
                      {programFilter !== 'all' && <span className="text-[#002147]"> • {programFilter.toUpperCase()}</span>}
                      {levelFilter !== 'all' && <span className="text-[#002147]"> • LEVEL {levelFilter}</span>}
                    </div>
                    <div className="text-[10.5px] text-slate-600 font-medium mt-1">
                      Period 1: <span className="font-bold text-slate-800">{pdfSettings.period1Time}</span> • Period 2: <span className="font-bold text-slate-800">{pdfSettings.period2Time}</span>
                    </div>
                  </div>
                </div>

                {/* MASTER TIMETABLE MATRIX */}
                <div className="mb-4 overflow-hidden">
                    
                    {/* Matrix Table with Navy/Gold Styling */}
                    <table className="w-full border-collapse border border-slate-300 text-[9px] table-fixed" style={{ width: '100%', tableLayout: 'fixed' }}>
                      <thead className="bg-[#002147] text-white">
                        <tr className="bg-[#002147] text-white">
                          <th style={{ width: '7.5%' }} className="border border-slate-400 p-1 text-center uppercase font-bold text-[8px] text-[#FFB81C] border-l-4 border-l-[#FFB81C]">
                            Date &amp; Day
                          </th>
                          <th style={{ width: '4.5%' }} className="border border-slate-400 p-1 text-center uppercase font-bold text-[7.5px] text-[#FFB81C]">
                            Period
                          </th>
                          {columnsToUse.map(colKey => {
                            const colWidth = `${88 / columnsToUse.length}%`;
                            if (matrixColumnMode === 'unified') {
                              return (
                                <th key={colKey} style={{ width: colWidth }} className="border border-slate-400 p-1 text-center font-bold bg-[#002147] text-white">
                                  <div className="text-[9px] font-black text-[#FFB81C] uppercase tracking-wider">{colKey}</div>
                                  <div className="text-slate-300 font-medium text-[7px]">PharmD &amp; Clinical</div>
                                </th>
                              );
                            }
                            const [prog, lvl] = colKey.split('|');
                            const isClinical = prog.toLowerCase().includes('clinical');
                            return (
                              <th key={colKey} style={{ width: colWidth }} className="border border-slate-400 p-1 text-center font-bold bg-[#002147]">
                                <div className={`text-[7.5px] font-black leading-tight ${isClinical ? 'text-[#FFB81C]' : 'text-white'}`}>{prog}</div>
                                <div className="text-slate-200 font-bold text-[7.5px]">{lvl}</div>
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
                                  style={{ backgroundColor: '#f8fafc', position: 'relative', zIndex: 10, width: '7.5%' }}
                                  className="border border-slate-300 p-0.5 text-center align-middle font-bold bg-[#F8FAFC] border-l-4 border-l-[#FFB81C] leading-tight"
                                >
                                  <div className="flex flex-col items-center justify-center h-full py-0.5">
                                    <div className="text-[9.5px] text-[#002147] font-extrabold">{dayName}</div>
                                    <div className="text-[7px] text-slate-600 font-bold mt-0.5 whitespace-nowrap">{formattedDate}</div>
                                  </div>
                                </td>
                              )}

                              <td 
                                style={{ backgroundColor: '#ffffff', width: '4.5%' }}
                                className="border border-slate-300 p-0.5 text-center font-bold align-middle bg-white"
                              >
                                <span className={`inline-block px-1 py-0.2 rounded text-[7px] font-bold ${periodNum === 1 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}`}>
                                  P{periodNum}
                                </span>
                              </td>

                              {columnsToUse.map(colKey => {
                                const assignedItems = matrixData[dateStr]?.[periodNum]?.[colKey] || [];
                                const colWidth = `${88 / columnsToUse.length}%`;

                                return (
                                  <td 
                                    key={colKey} 
                                    style={{ backgroundColor: '#ffffff', width: colWidth }}
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
                                              className="bg-white rounded-md border border-slate-300 shadow-2xs break-inside-avoid"
                                              style={{ 
                                                backgroundColor: '#ffffff', 
                                                border: '1px solid #cbd5e1', 
                                                borderRadius: '4px', 
                                                padding: '2px 3px', 
                                                marginBottom: '3px',
                                                boxSizing: 'border-box',
                                                width: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px'
                                              }}
                                            >
                                              {/* Card Header Row: Course Code + Student Count Micro Badge */}
                                              <div 
                                                style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'flex-start', 
                                                  justifyContent: 'space-between', 
                                                  gap: '2px',
                                                  borderBottom: '1px solid #e2e8f0', 
                                                  paddingBottom: '2px', 
                                                  width: '100%',
                                                  lineHeight: '1.2'
                                                }}
                                              >
                                                <span 
                                                  style={{ 
                                                    fontSize: '8px', 
                                                    fontWeight: '900', 
                                                    color: '#002147', 
                                                    letterSpacing: '-0.01em',
                                                    display: 'block',
                                                    wordBreak: 'break-word',
                                                    flex: 1
                                                  }}
                                                >
                                                  {c.course_code}
                                                </span>
                                                
                                                <span 
                                                  style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '1px 3px', 
                                                    fontSize: '7.5px', 
                                                    fontWeight: '900', 
                                                    lineHeight: '1', 
                                                    color: '#1e293b', 
                                                    backgroundColor: '#f1f5f9', 
                                                    border: '1px solid #cbd5e1', 
                                                    borderRadius: '3px',
                                                    flexShrink: 0
                                                  }}
                                                  title={`${c.student_count} Enrolled Students`}
                                                >
                                                  {c.student_count}
                                                </span>
                                              </div>
                                              
                                              {matrixColumnMode === 'unified' && (
                                                <div>
                                                  <span className={`text-[6.5px] font-extrabold px-1 py-0.5 rounded border ${
                                                    isClinical ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-blue-50 text-blue-900 border-blue-200'
                                                  }`}>
                                                    {c.program}
                                                  </span>
                                                </div>
                                              )}

                                              {/* Course Title */}
                                              <div 
                                                style={{ 
                                                  fontSize: '8px', 
                                                  fontWeight: '700', 
                                                  color: '#0f172a', 
                                                  lineHeight: '1.3', 
                                                  overflowWrap: 'break-word',
                                                  wordBreak: 'normal',
                                                  textAlign: 'left'
                                                }}
                                              >
                                                {c.course_title}
                                              </div>

                                              {/* Oral Exam Badge */}
                                              {c.has_oral_exam && (
                                                <div style={{ marginTop: '1px' }}>
                                                  <span 
                                                    style={{ 
                                                      display: 'inline-flex', 
                                                      alignItems: 'center',
                                                      padding: '1px 3px', 
                                                      fontSize: '7px', 
                                                      fontWeight: '800', 
                                                      lineHeight: '1', 
                                                      color: '#78350f', 
                                                      backgroundColor: '#fef3c7', 
                                                      border: '1px solid #fcd34d', 
                                                      borderRadius: '9999px' 
                                                    }}
                                                  >
                                                    🎤 Oral
                                                  </span>
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

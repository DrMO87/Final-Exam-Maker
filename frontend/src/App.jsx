import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import UserManagementModal from './components/UserManagementModal';
import PdfExportModal from './components/PdfExportModal';
import SessionForm from './components/SessionForm';
import FileUpload from './components/FileUpload';
import DataValidator from './components/DataValidator';
import ManualScheduler from './components/ManualScheduler';
import ScheduleViewer from './components/ScheduleViewer';
import CsvScheduleEvaluator from './components/CsvScheduleEvaluator';

function App() {
  const { user, logout } = useAuth();

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('scheduler_currentStep');
    return saved ? parseInt(saved) : 1;
  });
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('scheduler_sessionId') || null;
  });
  const [lockedAssignments, setLockedAssignments] = useState({});
  const [customCalendar, setCustomCalendar] = useState(null);
  const [schedule, setSchedule] = useState(null);
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCsvEvaluatorModal, setShowCsvEvaluatorModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Day / Night Theme State & Global Zoom State
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('hue_theme_mode') || 'day';
  });
  const [globalZoom, setGlobalZoom] = useState(() => {
    const saved = localStorage.getItem('hue_global_zoom');
    return saved ? parseInt(saved) : 100;
  });

  useEffect(() => {
    if (themeMode === 'night') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hue_theme_mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('hue_global_zoom', globalZoom);
  }, [globalZoom]);

  // Global PDF & System Settings state
  const [pdfSettings, setPdfSettings] = useState(() => {
    const saved = localStorage.getItem('hue_pdf_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      semester: 'Fall Semester',
      academicYear: '2025-2026',
      period1Time: '09:00 AM - 11:00 AM',
      period2Time: '12:00 PM - 02:00 PM',
      showSignatures: true,
      numSignatures: 2,
      signatories: [
        { name: 'Dr. Exam Control Chair', title: 'Head of Exam Control' },
        { name: 'Prof. Dean Signature', title: 'Dean of Faculty of Pharmacy' },
        { name: 'Vice Dean Signature', title: 'Vice Dean of Academic Affairs' },
        { name: 'Committee Member', title: 'Control Committee Secretary' }
      ],
      showStamp: false
    };
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('scheduler_sidebarCollapsed') === 'true';
  });

  useEffect(() => {
    if (currentStep > 1 && !sessionId) {
      setCurrentStep(1);
      return;
    }
    localStorage.setItem('scheduler_currentStep', currentStep);
    if (sessionId) {
      localStorage.setItem('scheduler_sessionId', sessionId);
    } else {
      localStorage.removeItem('scheduler_sessionId');
    }
  }, [currentStep, sessionId]);

  useEffect(() => {
    localStorage.setItem('scheduler_sidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('hue_pdf_settings', JSON.stringify(pdfSettings));
  }, [pdfSettings]);

  // If user is not authenticated, render Login screen
  if (!user) {
    return <Login />;
  }

  const handleSessionCreated = (id) => {
    setSessionId(id);
    setCurrentStep(2);
  };

  const handleFilesUploaded = () => {
    setCurrentStep(3); // Proceed to Audit & Validation
  };

  const handleAuditCompleteToManual = () => {
    setCurrentStep(4); // Proceed to Pre-Scheduling
  };

  const handleAuditCompleteToAuto = () => {
    setCurrentStep(5); // Proceed directly to Auto-Generate
  };

  const handleManualSchedulingComplete = (lockedData, scheduleData) => {
    setLockedAssignments(lockedData);
    if (scheduleData) {
      setSchedule(scheduleData);
    }
    setCurrentStep(5);
  };

  const handleScheduleGenerated = (scheduleData) => {
    setSchedule(scheduleData);
  };

  const resetApp = () => {
    setCurrentStep(1);
    setSessionId(null);
    setLockedAssignments({});
    setSchedule(null);
  };

  const handleStepClick = (stepNum) => {
    if (stepNum > 1 && !sessionId) return;
    setCurrentStep(stepNum);
    setIsMobileMenuOpen(false);
  };

  const handleSignatorySettingChange = (index, field, value) => {
    const updated = [...pdfSettings.signatories];
    updated[index][field] = value;
    setPdfSettings({ ...pdfSettings, signatories: updated });
  };

  const resetPdfSettings = () => {
    const defaults = {
      semester: 'Fall Semester',
      academicYear: '2025-2026',
      period1Time: '09:00 AM - 11:00 AM',
      period2Time: '12:00 PM - 02:00 PM',
      showSignatures: true,
      numSignatures: 2,
      signatories: [
        { name: 'Dr. Exam Control Chair', title: 'Head of Exam Control' },
        { name: 'Prof. Dean Signature', title: 'Dean of Faculty of Pharmacy' },
        { name: 'Vice Dean Signature', title: 'Vice Dean of Academic Affairs' },
        { name: 'Committee Member', title: 'Control Committee Secretary' }
      ],
      showStamp: false
    };
    setPdfSettings(defaults);
  };

  const stepsList = [
    { num: 1, label: 'Create Session', icon: '🏠', desc: 'Initialize session dates' },
    { num: 2, label: 'Upload Files', icon: '📋', desc: 'Courses & matrices' },
    { num: 3, label: 'Audit & Validate', icon: '📈', desc: 'Inspect metadata & conflicts' },
    { num: 4, label: 'Pre-Schedule', icon: '⚡', desc: 'Level & manual locks' },
    { num: 5, label: 'Generate Schedule', icon: '📅', desc: 'AI conflict resolution' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none relative">
      
      {/* Mobile Top Navbar (< md) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-13 bg-[#002147] text-white z-40 flex items-center justify-between px-3 border-b border-[#FFB81C]/30 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-base focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            ☰
          </button>
          <div className="flex items-center gap-1">
            <span className="font-extrabold text-xs tracking-tight font-outfit text-white">Exam Maker</span>
            <span className="text-[9px] font-bold text-[#FFB81C] bg-[#001530] px-1 py-0.2 rounded border border-[#FFB81C]/30">HUE</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Day / Night Mode Toggle Button */}
          <button
            onClick={() => setThemeMode(themeMode === 'day' ? 'night' : 'day')}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all border border-white/10"
            title="Toggle Day/Night Mode"
          >
            {themeMode === 'day' ? '☀️' : '🌙'}
          </button>

          {/* Global Zoom Controls */}
          <div className="flex items-center bg-white/10 rounded-lg px-1 py-0.5 text-xs font-bold text-white border border-white/10">
            <button 
              onClick={() => setGlobalZoom(Math.max(70, globalZoom - 10))}
              className="px-1.5 hover:text-[#FFB81C] active:scale-95"
              title="Zoom Out"
            >
              -
            </button>
            <span 
              onClick={() => setGlobalZoom(100)}
              className="px-1 text-[10px] text-white/90 cursor-pointer" 
              title="Reset to 100%"
            >
              {globalZoom}%
            </span>
            <button 
              onClick={() => setGlobalZoom(Math.min(150, globalZoom + 10))}
              className="px-1.5 hover:text-[#FFB81C] active:scale-95"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 shadow-2xl z-50 flex flex-col transition-transform md:transition-all duration-300 ${
          isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${
          isSidebarCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
        style={{ background: 'linear-gradient(180deg, #002147 0%, #001530 60%, #000d1f 100%)' }}
      >
        {/* Toggle Collapse Button (Desktop Only) */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex absolute -right-3.5 top-7 z-50 w-7 h-7 bg-[#001530] border border-white/20 rounded-full items-center justify-center text-white shadow-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all focus:outline-none"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Top Logo Container */}
        <div 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`border-b border-white/10 flex items-center justify-center cursor-pointer transition-all duration-300 ${
            isSidebarCollapsed ? 'px-2 py-4' : 'px-5 py-5'
          }`}
          title="Session Master - Final Exam Maker"
        >
          <div className={`relative w-full ${isSidebarCollapsed ? 'max-w-[40px]' : 'aspect-[1024/558]'} hover:scale-[1.03] transition-transform duration-300`}>
            <img
              src="/assets/sidebar_session_master_logo.png"
              alt="Session Master Logo"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Navigation Items Scroll Area */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          
          {/* GROUP 1: THE 5 STEPS WORKFLOW */}
          <div>
            {!isSidebarCollapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                EXAM MAKER STEPS
              </p>
            )}

            <ul className="space-y-1">
              {stepsList.map((step) => {
                const isActive = currentStep === step.num;
                const isCompleted = currentStep > step.num;
                const isDisabled = step.num > 1 && !sessionId;

                return (
                  <li key={step.num}>
                    <button
                      onClick={() => handleStepClick(step.num)}
                      disabled={isDisabled}
                      className={`
                        relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl
                        ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                        ${isActive 
                          ? 'bg-gradient-gold text-[#002147] font-bold shadow-glow-gold' 
                          : isDisabled
                            ? 'opacity-40 cursor-not-allowed text-white/40'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <span className="text-base">{step.icon}</span>
                      
                      {!isSidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold truncate">{step.label}</span>
                            {isCompleted && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center justify-center border border-emerald-400/30">✓</span>
                            )}
                          </div>
                          <p className={`text-[10px] truncate ${isActive ? 'text-[#002147]/70' : 'text-white/40'}`}>
                            {step.desc}
                          </p>
                        </div>
                      )}

                      {/* Active Indicator Bar */}
                      {isActive && (
                        <span className="absolute right-0 top-2 bottom-2 w-1 bg-[#002147] rounded-l-full" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* GROUP 2: UTILITY TOOLS */}
          <div>
            {!isSidebarCollapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                TOOLS &amp; UTILITIES
              </p>
            )}

            <ul className="space-y-1">
              {/* CSV Evaluator Quick Trigger */}
              <li>
                <button
                  onClick={() => setShowCsvEvaluatorModal(true)}
                  disabled={!sessionId}
                  className={`
                    relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl
                    ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                    ${!sessionId ? 'opacity-40 cursor-not-allowed text-white/40' : 'text-purple-200 hover:bg-purple-500/20 hover:text-white'}
                  `}
                >
                  <span className="text-sm">📊</span>
                  {!isSidebarCollapsed && <span className="text-xs font-medium flex-1">Schedule Evaluator</span>}
                </button>
              </li>

              {/* Settings Tab Modal Trigger */}
              <li>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className={`
                    relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl text-white/70 hover:bg-white/10 hover:text-white
                    ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  `}
                >
                  <span className="text-sm">⚙️</span>
                  {!isSidebarCollapsed && <span className="text-xs font-medium flex-1">Settings</span>}
                </button>
              </li>

              {/* Staff Accounts */}
              <li>
                <button
                  onClick={() => setShowUserModal(true)}
                  className={`
                    relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl text-white/70 hover:bg-white/10 hover:text-white
                    ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  `}
                >
                  <span className="text-sm">👥</span>
                  {!isSidebarCollapsed && <span className="text-xs font-medium flex-1">Staff Accounts</span>}
                </button>
              </li>

              {/* Help & Guide Modal Trigger */}
              <li>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className={`
                    relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl text-white/70 hover:bg-white/10 hover:text-white
                    ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  `}
                >
                  <span className="text-sm">❓</span>
                  {!isSidebarCollapsed && <span className="text-xs font-medium flex-1">Help & Guide</span>}
                </button>
              </li>
            </ul>
          </div>

        </nav>

        {/* Bottom Section with Display Controls, Sign Out, Version Badge, and Developer Credits */}
        <div className={`px-4 py-3 border-t border-white/10 space-y-2.5 ${isSidebarCollapsed ? 'items-center px-2' : ''}`}>
          
          {/* Global Theme & Zoom Controls */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 space-y-2">
            {!isSidebarCollapsed && (
              <p className="text-[9.5px] font-extrabold text-white/40 uppercase tracking-widest">Display &amp; Zoom</p>
            )}

            {/* Day / Night Toggle */}
            <button
              onClick={() => setThemeMode(themeMode === 'day' ? 'night' : 'day')}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-95 ${
                themeMode === 'night' 
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-400/40 shadow-xs' 
                  : 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-xs'
              }`}
              title="Switch Day/Night Mode"
            >
              <div className="flex items-center gap-2">
                <span>{themeMode === 'day' ? '☀️' : '🌙'}</span>
                {!isSidebarCollapsed && <span>{themeMode === 'day' ? 'Day Mode' : 'Night Mode'}</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-black/40 text-white/90">
                  {themeMode === 'day' ? 'Light' : 'Dark'}
                </span>
              )}
            </button>

            {/* Global Zoom Control Bar */}
            <div className="flex items-center justify-between bg-black/40 rounded-lg p-1 text-white border border-white/10">
              <button
                onClick={() => setGlobalZoom(Math.max(70, globalZoom - 10))}
                className="w-6 h-5 rounded flex items-center justify-center hover:bg-white/20 text-xs font-black transition-colors active:scale-95"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => setGlobalZoom(100)}
                className="text-[10px] font-bold px-1 hover:text-[#FFB81C] transition-colors"
                title="Reset Zoom to 100%"
              >
                {globalZoom}%
              </button>
              <button
                onClick={() => setGlobalZoom(Math.min(150, globalZoom + 10))}
                className="w-6 h-5 rounded flex items-center justify-center hover:bg-white/20 text-xs font-black transition-colors active:scale-95"
                title="Zoom In"
              >
                +
              </button>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white/80 bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 transition-colors border border-white/10 active:scale-95"
            title="Sign Out"
          >
            <span>🚪</span>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* Version Badge & Developer Credits */}
          {!isSidebarCollapsed && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-white/60 text-[8px] font-black">SM</span>
                </div>
                <div>
                  <p className="text-white/80 text-[10px] font-semibold leading-tight">Horus University — Egypt</p>
                  <p className="text-white/35 text-[8.5px]">v2.0 · Session Master</p>
                </div>
              </div>

              <div className="pt-1.5 border-t border-white/5">
                <p className="text-white/30 text-[8px] leading-relaxed">
                  Designed &amp; Executed by<br />
                  <span className="text-[#FFB81C] font-bold text-[9px]">Prof. Mahmoud Elkhoudary</span>
                </p>
              </div>
            </>
          )}
        </div>

      </aside>

      {/* Main Content Area with Global Zoom Scale Support */}
      <main 
        className={`flex-1 h-screen overflow-y-auto relative transition-all duration-300 pt-13 md:pt-0 ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
        style={{ zoom: `${globalZoom}%` }}
      >
        <div className={`w-full ${currentStep === 4 ? 'px-3 py-3' : 'px-4 py-8 md:px-8 md:py-12'}`}>
          <div className="animate-fade-in">
            {currentStep === 1 && (
              <div className="pt-4">
                <SessionForm onSessionCreated={handleSessionCreated} />
              </div>
            )}

            {currentStep === 2 && (
              <div className="pt-4">
                <FileUpload 
                  sessionId={sessionId} 
                  onFilesUploaded={handleFilesUploaded}
                  onBack={() => setCurrentStep(1)}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="pt-4">
                <DataValidator 
                  sessionId={sessionId}
                  onProceedToManual={handleAuditCompleteToManual}
                  onProceedToAuto={handleAuditCompleteToAuto}
                  onBack={() => setCurrentStep(2)}
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="pt-4 h-full">
                <ManualScheduler 
                  sessionId={sessionId}
                  pdfSettings={pdfSettings}
                  initialAssignments={lockedAssignments}
                  customCalendar={customCalendar}
                  onUpdatePdfSettings={setPdfSettings}
                  onComplete={handleManualSchedulingComplete}
                  onBack={() => setCurrentStep(3)}
                />
              </div>
            )}

            {currentStep === 5 && (
              <div className="pt-4">
                <ScheduleViewer 
                  sessionId={sessionId}
                  schedule={schedule}
                  lockedAssignments={lockedAssignments}
                  pdfSettings={pdfSettings}
                  onUpdatePdfSettings={setPdfSettings}
                  onScheduleGenerated={handleScheduleGenerated}
                  onBack={() => setCurrentStep(4)}
                  onReset={resetApp}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Accounts Management Modal */}
      {showUserModal && (
        <UserManagementModal onClose={() => setShowUserModal(false)} />
      )}

      {/* PDF Export Studio Modal */}
      {showPdfModal && (
        <PdfExportModal
          sessionId={sessionId}
          scheduleData={schedule ? { schedule } : { schedule: [] }}
          pdfSettings={pdfSettings}
          onUpdatePdfSettings={(newSettings) => setPdfSettings(newSettings)}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Dedicated System & PDF Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-[#002147] font-outfit flex items-center gap-2">
                <span>⚙️</span> Settings & PDF Preferences
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">

              {/* Periods Config Setup */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="font-bold text-[#002147] text-xs">⏰ Examination Period Times</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Period 1 Time</label>
                    <input
                      type="text"
                      value={pdfSettings.period1Time}
                      onChange={(e) => setPdfSettings({ ...pdfSettings, period1Time: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                      placeholder="09:00 AM - 11:00 AM"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Period 2 Time</label>
                    <input
                      type="text"
                      value={pdfSettings.period2Time}
                      onChange={(e) => setPdfSettings({ ...pdfSettings, period2Time: e.target.value })}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                      placeholder="12:00 PM - 02:00 PM"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Signatures & Titles Setup */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-[#002147] text-xs">✍️ Customized Document Signatures</div>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={pdfSettings.showSignatures}
                      onChange={(e) => setPdfSettings({ ...pdfSettings, showSignatures: e.target.checked })}
                      className="rounded text-[#002147]"
                    />
                    Enable Block
                  </label>
                </div>

                {pdfSettings.showSignatures && (
                  <>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Number of Signatories</label>
                      <select
                        value={pdfSettings.numSignatures}
                        onChange={(e) => setPdfSettings({ ...pdfSettings, numSignatures: Number(e.target.value) })}
                        className="w-full h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                      >
                        <option value={1}>1 Signatory</option>
                        <option value={2}>2 Signatories</option>
                        <option value={3}>3 Signatories</option>
                        <option value={4}>4 Signatories</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {Array.from({ length: pdfSettings.numSignatures }).map((_, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-2 bg-white p-2 rounded-xl border border-slate-200">
                          <input
                            type="text"
                            value={pdfSettings.signatories[idx]?.name || ''}
                            onChange={(e) => handleSignatorySettingChange(idx, 'name', e.target.value)}
                            placeholder={`#${idx + 1} Signatory Name`}
                            className="h-7 px-2 border border-slate-200 rounded-lg text-xs font-medium"
                          />
                          <input
                            type="text"
                            value={pdfSettings.signatories[idx]?.title || ''}
                            onChange={(e) => handleSignatorySettingChange(idx, 'title', e.target.value)}
                            placeholder={`#${idx + 1} Official Title`}
                            className="h-7 px-2 border border-slate-200 rounded-lg text-xs font-bold text-[#002147]"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Table Stamp Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#002147] text-xs">🔴 Final Version Stamp</div>
                  <div className="text-slate-500 text-[11px]">Include tilted red rectangular "FINAL VERSION" rubber stamp at bottom of document</div>
                </div>
                <input
                  type="checkbox"
                  checked={pdfSettings.showStamp}
                  onChange={(e) => setPdfSettings({ ...pdfSettings, showStamp: e.target.checked })}
                  className="w-4 h-4 rounded text-[#002147]"
                />
              </div>

            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={resetPdfSettings}
                className="btn btn-secondary btn-sm text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Restore Defaults
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2 bg-[#002147] text-white font-bold rounded-xl text-xs hover:bg-[#001530] transition-all shadow-md"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Help & Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-[#002147] font-outfit flex items-center gap-2">
                <span>❓</span> Help & User Guide — Final Exam Maker
              </h3>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="font-bold text-[#002147] text-sm mb-1">🚀 Quick Start Workflow</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li><strong>Step 1 (Create Session):</strong> Set up session dates and semester label.</li>
                  <li><strong>Step 2 (Upload Files):</strong> Upload student numbers, course metadata, and conflict matrix CSV files (or click Auto-Fill Built-in Samples).</li>
                  <li><strong>Step 3 (Audit & Validate):</strong> Review metadata, student enrollments, oral exam flags, and conflict matrix calculations.</li>
                  <li><strong>Step 4 (Pre-Scheduling):</strong> Optionally drag & drop courses into fixed exam days or use Auto-Schedule Level.</li>
                  <li><strong>Step 5 (Generate Schedule):</strong> Let AI auto-generate an optimized, conflict-free final exam schedule and export to PDF/Markdown.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="font-bold text-[#002147] text-xs">📋 Required CSV File Formats</div>
                <p>Ensure file names contain keywords like <code>student</code>, <code>pharmd</code>, <code>clinical</code>, or <code>conflict</code> for auto-matching on upload.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="btn btn-primary btn-sm px-5"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSV / Excel Evaluator Modal */}
      {showCsvEvaluatorModal && (
        <CsvScheduleEvaluator
          sessionId={sessionId}
          onApplySchedule={(assignmentsMap, newCalendar) => {
            setLockedAssignments(assignmentsMap);
            if (newCalendar) setCustomCalendar(newCalendar);
            setShowCsvEvaluatorModal(false);
            setCurrentStep(4);
          }}
          onClose={() => setShowCsvEvaluatorModal(false)}
        />
      )}
    </div>
  );
}

export default App;

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
  const [schedule, setSchedule] = useState(null);
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  const handleManualSchedulingComplete = (lockedData) => {
    setLockedAssignments(lockedData);
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
  };

  const stepsList = [
    { num: 1, label: 'Create Session', icon: '🏠', desc: 'Initialize session dates' },
    { num: 2, label: 'Upload Files', icon: '📋', desc: 'Courses & matrices' },
    { num: 3, label: 'Audit & Validate', icon: '📈', desc: 'Inspect metadata & conflicts' },
    { num: 4, label: 'Pre-Schedule', icon: '⚡', desc: 'Level & manual locks' },
    { num: 5, label: 'Generate Schedule', icon: '📅', desc: 'AI conflict resolution' }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none">
      
      {/* Sidebar matching exact design concept from Supervisors Automated Assign navigation.tsx */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 shadow-2xl z-50 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
        style={{ background: 'linear-gradient(180deg, #002147 0%, #001530 60%, #000d1f 100%)' }}
      >
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-7 z-50 w-7 h-7 bg-[#001530] border border-white/20 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all focus:outline-none"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Top Logo Container */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-center">
          <img
            src="/assets/session_master_shield_logo.png"
            alt="Session Master Logo"
            className={`${isSidebarCollapsed ? 'w-10 h-10' : 'h-14'} w-auto object-contain transition-all duration-300 drop-shadow-lg cursor-pointer hover:scale-105`}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
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
                        ${isActive ? 'bg-white/15 text-white font-bold' : 
                          isDisabled ? 'opacity-30 cursor-not-allowed text-white/40' : 'text-white/60 hover:bg-white/10 hover:text-white/90'}
                      `}
                    >
                      {/* Active Left Gradient Bar Accent */}
                      {isActive && (
                        <span 
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full shadow-glow-gold"
                          style={{ background: 'linear-gradient(135deg, #FFB81C, #FFE04A)' }}
                        />
                      )}

                      {/* Step Number Circle / Completed Icon */}
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        isActive ? 'bg-[#FFB81C] text-[#001530]' : 
                        isCompleted ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'
                      }`}>
                        {isCompleted ? '✓' : step.num}
                      </span>

                      {!isSidebarCollapsed && (
                        <div className="flex-1 overflow-hidden">
                          <div className="text-xs leading-tight font-semibold">{step.label}</div>
                          <div className="text-[10px] text-white/40 truncate font-normal mt-0.5">{step.desc}</div>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* GROUP 2: SYSTEM TOOLS & SETTINGS */}
          <div>
            {!isSidebarCollapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                SYSTEM & TOOLS
              </p>
            )}

            <ul className="space-y-1">
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

              {/* PDF Reports Studio */}
              <li>
                <button
                  onClick={() => setShowPdfModal(true)}
                  className={`
                    relative flex items-center gap-3 w-full text-left transition-all duration-150 rounded-xl text-white/70 hover:bg-white/10 hover:text-white
                    ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                  `}
                >
                  <span className="text-sm">📄</span>
                  {!isSidebarCollapsed && <span className="text-xs font-medium flex-1">PDF Reports Studio</span>}
                </button>
              </li>
            </ul>
          </div>

        </nav>

        {/* Bottom Section with Sign Out, Version Badge, and Developer Credits */}
        <div className={`px-5 py-4 border-t border-white/10 space-y-3 ${isSidebarCollapsed ? 'items-center px-2' : ''}`}>
          
          {/* Sign Out Button */}
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/70 bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 transition-colors border border-white/10"
            title="Sign Out"
          >
            <span>🚪</span>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* Version Badge & Developer Credits */}
          {!isSidebarCollapsed && (
            <>
              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-white/60 text-[9px] font-black">SM</span>
                </div>
                <div>
                  <p className="text-white/80 text-[11px] font-semibold leading-tight">Horus University — Egypt</p>
                  <p className="text-white/35 text-[9px] mt-0.5">v2.0 · Session Master</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-white/30 text-[8px] leading-relaxed">
                  Designed &amp; Executed by<br />
                  <span className="text-[#FFB81C] font-bold text-[9.5px]">Prof. Mahmoud Elkhoudary</span>
                </p>
              </div>
            </>
          )}
        </div>

      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 h-screen overflow-y-auto relative transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        <div className="w-full px-4 py-8 md:px-8 md:py-12">
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
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Dedicated System & PDF Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-[#002147] font-outfit flex items-center gap-2">
                <span>⚙️</span> Settings & System Preferences
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base"
              >
                ✕
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="font-bold text-[#002147] mb-1">🏢 Room Capacity Overflow Limit</div>
                <p className="text-slate-500 leading-relaxed">
                  Default period slot capacity limit is set at <span className="font-bold text-slate-800">1,000 students</span> per period. Manual auto-scheduling automatically directs overflow into Period 2.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="font-bold text-[#002147] mb-1">📄 PDF Export Layout Presets</div>
                <p className="text-slate-500 leading-relaxed">
                  Toggle between <span className="font-bold text-slate-800">Hall Supervision Schedule</span> (4 logos, room info, RTL Arabic supervisors) and <span className="font-bold text-slate-800">Master Timetable Matrix</span> in the Reports Studio.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="font-bold text-[#002147] mb-1">🔑 Account & Security</div>
                <p className="text-slate-500 leading-relaxed">
                  Manage staff roles and authorized personnel using <span className="font-bold text-slate-800">Staff Accounts</span> in the sidebar.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2 bg-[#002147] text-white font-bold rounded-xl text-xs hover:bg-[#001530] transition-all shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

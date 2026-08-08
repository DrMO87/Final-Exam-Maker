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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none">
      {/* Sidebar matching exact structure from reference screenshot */}
      <aside 
        className={`bg-[#001738] text-white shrink-0 shadow-2xl z-20 flex flex-col relative transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-7 z-30 w-7 h-7 bg-[#0B1E36] border border-white/20 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all focus:outline-none"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Sidebar Brand Header */}
        <div 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`p-4 border-b border-white/10 flex items-center cursor-pointer hover:bg-white/5 transition-all ${
            isSidebarCollapsed ? 'justify-center py-4' : 'px-5 py-4'
          }`}
          title="Session Master - Final Exam Maker"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <img 
              src="/assets/session_master_shield_logo.png" 
              alt="Session Master Logo" 
              className={`${isSidebarCollapsed ? 'w-10 h-10' : 'h-14'} w-auto object-contain shrink-0 drop-shadow-md transition-all`} 
            />
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 flex flex-col gap-5 overflow-y-auto">
          
          {/* SECTION 1: OVERVIEW */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                OVERVIEW
              </div>
            )}

            <div className="space-y-1">
              {/* Home / Step 1 */}
              <div
                onClick={() => handleStepClick(1)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl cursor-pointer transition-all ${
                  currentStep === 1 
                    ? 'bg-blue-600/30 text-white font-bold border-l-4 border-[#D4AF37]' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
                title="Home (Session Initialization)"
              >
                <span className="text-base">🏠</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Home</span>}
              </div>

              {/* Schedule / Step 5 */}
              <div
                onClick={() => handleStepClick(5)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl transition-all ${
                  !sessionId ? 'opacity-40 cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white'
                } ${currentStep === 5 ? 'bg-blue-600/30 text-white font-bold border-l-4 border-[#D4AF37]' : ''}`}
                title="Schedule (Timetable & Matrix)"
              >
                <span className="text-base">📅</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Schedule</span>}
              </div>

              {/* Analytics / Step 3 */}
              <div
                onClick={() => handleStepClick(3)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl transition-all ${
                  !sessionId ? 'opacity-40 cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white'
                } ${currentStep === 3 ? 'bg-blue-600/30 text-white font-bold border-l-4 border-[#D4AF37]' : ''}`}
                title="Analytics & Conflict Inspection"
              >
                <span className="text-base">📈</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Analytics</span>}
              </div>
            </div>
          </div>

          {/* SECTION 2: DATA SETUP */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                DATA SETUP
              </div>
            )}

            <div className="space-y-1">
              {/* Staff / Accounts Modal */}
              <div
                onClick={() => setShowUserModal(true)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white transition-all`}
                title="Staff User Management"
              >
                <span className="text-base">👥</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Staff</span>}
              </div>

              {/* Rooms */}
              <div
                onClick={() => setShowSettingsModal(true)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white transition-all`}
                title="Rooms & Capacity Setup"
              >
                <span className="text-base">🏢</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Rooms</span>}
              </div>

              {/* Exams / Step 2 File Upload */}
              <div
                onClick={() => handleStepClick(2)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl transition-all ${
                  !sessionId ? 'opacity-40 cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white'
                } ${currentStep === 2 ? 'bg-blue-600/30 text-white font-bold border-l-4 border-[#D4AF37]' : ''}`}
                title="Exams Data (Upload Courses & Conflict Matrices)"
              >
                <span className="text-base">📋</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Exams</span>}
              </div>
            </div>
          </div>

          {/* SECTION 3: OPERATIONS */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                OPERATIONS
              </div>
            )}

            <div className="space-y-1">
              {/* Auto-Assign / Step 4 */}
              <div
                onClick={() => handleStepClick(4)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl transition-all ${
                  !sessionId ? 'opacity-40 cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white'
                } ${currentStep === 4 ? 'bg-blue-600/30 text-white font-bold border-l-4 border-[#D4AF37]' : ''}`}
                title="Auto-Assign & Pre-Scheduling"
              >
                <span className="text-base">⚡</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Auto-Assign</span>}
              </div>

              {/* Reports / PDF Studio Modal */}
              <div
                onClick={() => setShowPdfModal(true)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white transition-all`}
                title="Reports & PDF Export Studio"
              >
                <span className="text-base">📄</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Reports</span>}
              </div>

              {/* Settings Tab */}
              <div
                onClick={() => setShowSettingsModal(true)}
                className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'} rounded-xl cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white transition-all`}
                title="System & PDF Settings"
              >
                <span className="text-base">⚙️</span>
                {!isSidebarCollapsed && <span className="text-xs font-semibold">Settings</span>}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Section */}
        <div className={`p-4 border-t border-white/10 flex flex-col gap-3 ${isSidebarCollapsed ? 'items-center p-2' : ''}`}>
          
          {/* Sign Out Button */}
          <button
            onClick={logout}
            className={`flex items-center justify-center gap-2 ${isSidebarCollapsed ? 'p-2' : 'py-2 px-3'} bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-rose-500/30`}
            title="Sign Out"
          >
            <span className="text-base">🚪</span>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>

          {/* Profile / Institution Badge */}
          {!isSidebarCollapsed && (
            <div className="pt-1 border-t border-white/5 text-center">
              <div className="text-xs font-bold text-white truncate">
                Horus University — Egypt
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                v2.0 · Session Master
              </div>

              {/* Developer Credits */}
              <div className="mt-2 pt-2 border-t border-white/10 text-[9.5px]">
                <div className="text-slate-400">Designed & Executed by</div>
                <div className="font-extrabold text-[#D4AF37] tracking-wide mt-0.5">
                  Prof. Mahmoud Elkhoudary
                </div>
              </div>
            </div>
          )}
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative">
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-[#0B1E36] font-outfit flex items-center gap-2">
                <span>⚙️</span> System & PDF Settings
              </h3>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-[#0B1E36] mb-1">🏢 Room Allocation & Capacity Limit</div>
                <p className="text-slate-500 leading-relaxed">
                  Default period slot limit is configured at 1,000 students per period slot. Auto-overflow directs remaining students to Period 2.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-[#0B1E36] mb-1">📄 PDF Export Settings</div>
                <p className="text-slate-500 leading-relaxed">
                  You can configure Semester, Periods (Period 1 / Period 2 times), and custom signatory names/titles directly in the Reports studio.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 bg-[#0B1E36] text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all"
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

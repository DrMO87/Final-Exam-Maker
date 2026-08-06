import { useState, useEffect } from 'react';
import SessionForm from './components/SessionForm';
import FileUpload from './components/FileUpload';
import DataValidator from './components/DataValidator';
import ManualScheduler from './components/ManualScheduler';
import ScheduleViewer from './components/ScheduleViewer';

function App() {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('scheduler_currentStep');
    return saved ? parseInt(saved) : 1;
  });
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('scheduler_sessionId') || null;
  });
  const [lockedAssignments, setLockedAssignments] = useState({});
  const [schedule, setSchedule] = useState(null);

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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Retractable Dark Blue Sidebar */}
      <aside 
        className={`bg-gradient-sidebar text-white shrink-0 shadow-2xl z-20 flex flex-col relative transition-all duration-300 select-none ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3.5 top-7 z-30 w-7 h-7 bg-slate-800 border border-white/20 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-slate-700 hover:scale-110 active:scale-95 transition-all focus:outline-none"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
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

        {/* Sidebar Header */}
        <div className={`p-6 pb-4 border-b border-white/10 flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-between'}`}>
          <h1 className="text-2xl font-bold font-outfit tracking-tight text-white drop-shadow-sm flex items-center gap-3 overflow-hidden">
            <span 
              className="text-3xl shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
              title="Exam Scheduler"
            >
              📚
            </span>
            {!isSidebarCollapsed && (
              <span className="whitespace-nowrap transition-opacity duration-300">Exam<br/>Scheduler</span>
            )}
          </h1>
        </div>

        {/* Steps Navigation */}
        <div className={`flex-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'} py-6 flex flex-col gap-2.5 overflow-y-auto`}>
          {[
            { num: 1, label: 'Create Session', desc: 'Initialize dates' },
            { num: 2, label: 'Upload Files', desc: 'Courses & matrices' },
            { num: 3, label: 'Audit & Validate', desc: 'Inspect metadata & conflicts' },
            { num: 4, label: 'Pre-Schedule', desc: 'Level & manual locks' },
            { num: 5, label: 'Generate', desc: 'AI conflict resolution' }
          ].map((step) => {
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;
            const isDisabled = step.num > 1 && !sessionId;
            
            return (
              <div key={step.num} 
                onClick={() => handleStepClick(step.num)}
                title={isSidebarCollapsed ? `Step ${step.num}: ${step.label} (${step.desc})` : undefined}
                className={`
                flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'} rounded-xl transition-all duration-300 relative group
                ${!isDisabled ? 'cursor-pointer hover:bg-white/5' : 'cursor-not-allowed'}
                ${isActive ? 'bg-white/10 text-white shadow-glow-primary border border-white/20' : 
                  isCompleted ? 'text-white border border-transparent' : 'text-white/40 border border-transparent'}
              `}>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-hue-gold rounded-r-full shadow-glow-gold"></div>
                )}
                <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-xs shadow-inner transition-colors duration-300
                  ${isActive ? 'bg-gradient-gold text-hue-navy shadow-glow-gold' : 
                    isCompleted ? 'bg-semantic-success text-white' : 'bg-white/10 text-white/50'}`}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                  ) : step.num}
                </div>
                {!isSidebarCollapsed && (
                  <div className="overflow-hidden transition-all duration-300">
                    <div className={`font-semibold text-xs whitespace-nowrap ${isActive ? 'text-white' : isCompleted ? 'text-white/90' : 'text-white/50'}`}>
                      {step.label}
                    </div>
                    <div className={`text-[10px] whitespace-nowrap ${isActive ? 'text-white/70' : 'text-white/40'}`}>
                      {step.desc}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className={`${isSidebarCollapsed ? 'p-3' : 'p-5'} mt-auto border-t border-white/10 flex flex-col items-center`}>
          {!isSidebarCollapsed && (
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3 w-full">
              <p className="text-[11px] text-white/60 font-medium leading-relaxed">
                Intelligent exam scheduling with automated conflict resolution engine.
              </p>
            </div>
          )}
          <button 
            onClick={resetApp}
            title={isSidebarCollapsed ? "Start Over / Reset" : undefined}
            className={`w-full flex items-center justify-center gap-2 ${isSidebarCollapsed ? 'p-3' : 'py-2.5 px-3'} rounded-xl font-bold text-xs bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 hover:text-white transition-all shadow-sm`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            {!isSidebarCollapsed && <span>Start Over / Reset</span>}
          </button>
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
    </div>
  );
}

export default App;


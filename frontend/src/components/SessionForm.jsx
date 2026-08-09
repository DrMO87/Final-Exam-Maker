import { useState, useEffect } from 'react';
import axios from 'axios';

function SessionForm({ onSessionCreated }) {
  const [semesterType, setSemesterType] = useState('Fall Semester');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  
  const [formData, setFormData] = useState({
    session_name: 'Fall Semester 2025-2026 Final Exams',
    start_date: '2025-12-29',
    end_date: '2026-01-22'
  });

  const [vacationDateInput, setVacationDateInput] = useState('');
  const [excludedDates, setExcludedDates] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pastSessions, setPastSessions] = useState([]);

  useEffect(() => {
    fetchPastSessions();
  }, []);

  // Update session_name automatically when semester or academic year changes
  useEffect(() => {
    const fullSemester = `${semesterType} (${academicYear})`;
    setFormData(prev => ({
      ...prev,
      session_name: `${semesterType} ${academicYear} Final Exams`
    }));

    // Synchronize global PDF settings in localStorage so PDF studio uses Step 1 semester
    try {
      const savedPdfSettings = JSON.parse(localStorage.getItem('hue_pdf_settings') || '{}');
      const updated = {
        ...savedPdfSettings,
        semester: semesterType,
        academicYear: academicYear
      };
      localStorage.setItem('hue_pdf_settings', JSON.stringify(updated));
    } catch (e) {}
  }, [semesterType, academicYear]);

  const fetchPastSessions = async () => {
    try {
      const res = await axios.get('/api/scheduler/sessions');
      if (res.data.success) {
        setPastSessions(res.data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching past sessions:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddVacationDate = () => {
    if (!vacationDateInput) return;
    if (excludedDates.includes(vacationDateInput)) {
      alert('This vacation date has already been added.');
      return;
    }
    setExcludedDates([...excludedDates, vacationDateInput].sort());
    setVacationDateInput('');
  };

  const handleRemoveVacationDate = (dateToRemove) => {
    setExcludedDates(excludedDates.filter(d => d !== dateToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const fullSemesterLabel = `${semesterType} (${academicYear})`;
      const payload = {
        session_name: formData.session_name,
        semester: fullSemesterLabel,
        start_date: formData.start_date,
        end_date: formData.end_date,
        excluded_dates: excludedDates
      };

      const response = await axios.post('/api/scheduler/session', payload);
      
      if (response.data.success) {
        // Synchronize global PDF settings in localStorage
        try {
          const savedPdfSettings = JSON.parse(localStorage.getItem('hue_pdf_settings') || '{}');
          localStorage.setItem('hue_pdf_settings', JSON.stringify({
            ...savedPdfSettings,
            semester: semesterType,
            academicYear: academicYear
          }));
        } catch (e) {}

        onSessionCreated(response.data.session.id);
      } else {
        setError('Failed to create session');
      }
    } catch (err) {
      console.error('Error creating session:', err);
      const apiErr = err.response?.data?.error;
      const errMsg = typeof apiErr === 'object' ? apiErr.message : apiErr;
      setError(errMsg || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId, sessionName, e) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete session "${sessionName}"? This action cannot be undone.`)) return;

    try {
      await axios.delete(`/api/scheduler/session/${sessionId}`);
      fetchPastSessions();
    } catch (err) {
      alert('Failed to delete session: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="card max-w-3xl mx-auto shadow-xl border border-slate-200">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <h2 className="text-xl font-extrabold text-[#002147] font-outfit mb-1">
          Create New Scheduling Session — Horus University Egypt
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Configure exam dates, active semester, and official vacation days to generate your conflict-free timetable.
        </p>
      </div>

      {error && <div className="bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger px-4 py-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Session Name & Semester Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label text-slate-700 font-bold" htmlFor="semesterType">Academic Semester *</label>
            <select
              id="semesterType"
              value={semesterType}
              onChange={(e) => setSemesterType(e.target.value)}
              className="input font-bold text-[#002147] h-10"
              required
            >
              <option value="Fall Semester">Fall Semester</option>
              <option value="Spring Semester">Spring Semester</option>
              <option value="Summer Semester">Summer Semester</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label text-slate-700 font-bold" htmlFor="academicYear">Academic Year *</label>
            <select
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="input font-bold text-slate-800 h-10"
              required
            >
              <option value="2024-2025">2024–2025</option>
              <option value="2025-2026">2025–2026</option>
              <option value="2026-2027">2026–2027</option>
              <option value="2027-2028">2027–2028</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="label text-slate-700 font-bold" htmlFor="session_name">Session Title *</label>
          <input
            className="input font-medium text-slate-800"
            type="text"
            id="session_name"
            name="session_name"
            value={formData.session_name}
            onChange={handleChange}
            placeholder="e.g., Fall 2025-2026 Final Exams"
            required
          />
        </div>

        {/* Date Range Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label text-slate-700 font-bold" htmlFor="start_date">Exam Period Start Date *</label>
            <input
              className="input text-xs font-semibold"
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="label text-slate-700 font-bold" htmlFor="end_date">Exam Period End Date *</label>
            <input
              className="input text-xs font-semibold"
              type="date"
              id="end_date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* OFFICIAL VACATIONS & EXCLUDED DATES SECTION */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-[#002147] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span>🏖️</span> Official Vacations & Excluded Exam Days <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Add national holidays or university vacations during the exam period. No exams will be scheduled on these dates.
              </p>
            </div>
          </div>

          {/* Date Picker Input Row */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={vacationDateInput}
              min={formData.start_date}
              max={formData.end_date}
              onChange={(e) => setVacationDateInput(e.target.value)}
              className="input h-9 text-xs font-semibold w-48 bg-white border-slate-300"
            />
            <button
              type="button"
              onClick={handleAddVacationDate}
              className="px-3 h-9 bg-[#002147] hover:bg-[#001530] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1"
            >
              ➕ Add Vacation Date
            </button>
          </div>

          {/* Excluded Dates Badges List */}
          {excludedDates.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {excludedDates.map(dateStr => (
                <span 
                  key={dateStr}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold shadow-2xs"
                >
                  <span>🏖️ {dateStr}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveVacationDate(dateStr)}
                    className="text-amber-700 hover:text-red-700 font-extrabold hover:bg-amber-100 rounded-full w-4 h-4 flex items-center justify-center leading-none text-xs"
                    title="Remove vacation date"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">No vacation dates added. Fridays are automatically excluded.</div>
          )}
        </div>

        <div className="flex gap-4 pt-3 border-t border-slate-100">
          <button
            className="btn btn-primary shadow-glow-primary flex-1 py-3 font-extrabold text-sm"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Initializing Session...' : '🚀 Initialize Scheduling Session'}
          </button>
        </div>
      </form>

      {/* Existing Sessions Browser */}
      {pastSessions.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200">
          <h4 className="text-xs font-bold text-hue-navy uppercase tracking-wider mb-3">📜 Resume Existing Session ({pastSessions.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {pastSessions.map(sess => (
              <div 
                key={sess.id}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-hue-gold transition-all"
              >
                <div>
                  <div className="font-bold text-xs text-hue-navy">{sess.session_name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {sess.semester} • {sess.start_date} to {sess.end_date}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSessionCreated(sess.id)}
                    className="btn btn-secondary btn-sm text-xs font-bold border-hue-gold/50 text-hue-navy hover:bg-hue-gold/15"
                  >
                    📂 Open Session
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(sess.id, sess.session_name, e)}
                    className="p-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors"
                    title="Delete Session"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restore Backup Section */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">📂 Restore Previous Session Backup</h4>
        <p className="text-xs text-slate-500 mb-3">Upload a previously exported session JSON file to restore all courses, conflicts, and vaulted schedules.</p>
        
        <label className="btn btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer border-slate-300">
          <span>📂 Select Backup (.json)</span>
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setLoading(true);
                setError('');
                const text = await file.text();
                const backupData = JSON.parse(text);

                const res = await axios.post('/api/scheduler/restore', backupData);
                if (res.data.success) {
                  alert(`Session "${res.data.session.session_name}" restored successfully!`);
                  onSessionCreated(res.data.newSessionId);
                } else {
                  setError('Failed to restore session');
                }
              } catch (err) {
                setError('Invalid backup JSON file: ' + err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

export default SessionForm;

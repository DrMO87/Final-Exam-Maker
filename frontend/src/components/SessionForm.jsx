import { useState, useEffect } from 'react';
import axios from 'axios';

function SessionForm({ onSessionCreated }) {
  const [formData, setFormData] = useState({
    session_name: '',
    semester: 'Fall 2025-2026',
    start_date: '2025-12-29',
    end_date: '2026-01-22'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pastSessions, setPastSessions] = useState([]);

  useEffect(() => {
    fetchPastSessions();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/scheduler/session', formData);
      
      if (response.data.success) {
        onSessionCreated(response.data.session.id);
      } else {
        setError('Failed to create session');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-2xl mx-auto">
      <h2 className="mb-2">Create New Scheduling Session</h2>
      <p className="text-slate-500 mb-8">
        Set up a new exam scheduling session for the semester
      </p>

      {error && <div className="bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger px-4 py-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="label" htmlFor="session_name">Session Name *</label>
          <input
            className="input"
            type="text"
            id="session_name"
            name="session_name"
            value={formData.session_name}
            onChange={handleChange}
            placeholder="e.g., Fall 2025-2026 Final Exams"
            required
          />
        </div>

        <div className="form-group">
          <label className="label" htmlFor="semester">Semester *</label>
          <input
            className="input"
            type="text"
            id="semester"
            name="semester"
            value={formData.semester}
            onChange={handleChange}
            placeholder="e.g., Fall 2025-2026"
            required
          />
        </div>

        <div className="form-group">
          <label className="label" htmlFor="start_date">Exam Period Start Date *</label>
          <input
            className="input"
            type="date"
            id="start_date"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label className="label" htmlFor="end_date">Exam Period End Date *</label>
          <input
            className="input"
            type="date"
            id="end_date"
            name="end_date"
            value={formData.end_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-100 mt-6">
          <button
            className="btn btn-primary shadow-glow-primary flex-1"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Session'}
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
                <button
                  type="button"
                  onClick={() => onSessionCreated(sess.id)}
                  className="btn btn-secondary btn-sm text-xs font-bold border-hue-gold/50 text-hue-navy hover:bg-hue-gold/15"
                >
                  📂 Open Session
                </button>
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

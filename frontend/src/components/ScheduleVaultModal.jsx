import { useState, useEffect } from 'react';
import axios from 'axios';

function ScheduleVaultModal({ sessionId, currentSchedule, lockedAssignments, onSelectSchedule, onClose }) {
  const [vaultItems, setVaultItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewScope, setViewScope] = useState('all'); // 'all' or 'current'

  useEffect(() => {
    fetchVault();
  }, [sessionId, viewScope]);

  const fetchVault = async () => {
    try {
      setLoading(true);
      const targetId = viewScope === 'current' ? sessionId : 'all';
      const res = await axios.get(`/api/scheduler/vault/${targetId}`);
      if (res.data.success) {
        setVaultItems(res.data.vault || []);
      }
    } catch (err) {
      console.error('Error loading vault:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCurrent = async (e) => {
    e.preventDefault();
    if (!saveName.trim()) return;

    try {
      setIsSaving(true);
      const res = await axios.post('/api/scheduler/vault/save', {
        session_id: sessionId,
        name: saveName.trim(),
        schedule_data: currentSchedule,
        locked_assignments: lockedAssignments,
        violation_count: currentSchedule?.violations?.length || 0
      });

      if (res.data.success) {
        setSaveName('');
        fetchVault();
      }
    } catch (err) {
      alert('Failed to save to vault: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}" from your schedule vault?`)) return;

    try {
      await axios.delete(`/api/scheduler/vault/${id}`);
      fetchVault();
    } catch (err) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hue-navy text-hue-gold flex items-center justify-center text-xl shadow-sm">
              🏛️
            </div>
            <div>
              <h3 className="text-lg font-bold text-hue-navy mb-0.5">Schedule Vault & Comparison Matrix</h3>
              <p className="text-xs text-slate-500">Save, compare, and restore optimal schedule variants for this session.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Save Current Schedule Section */}
          {currentSchedule && currentSchedule.schedule && (
            <div className="bg-gradient-to-r from-hue-navy/5 via-hue-gold/5 to-slate-50 border border-hue-navy/15 rounded-xl p-4 shadow-sm">
              <h4 className="text-xs font-bold text-hue-navy uppercase tracking-wider mb-2">⭐ Save Active Schedule to Vault</h4>
              <form onSubmit={handleSaveCurrent} className="flex gap-3">
                <input
                  type="text"
                  placeholder="e.g. Option A - Zero Violations, Option B - Thursday Spread..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="input-field flex-1 text-xs py-2"
                  required
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary btn-sm px-4 shadow-glow-primary text-xs font-bold shrink-0"
                >
                  {isSaving ? 'Saving...' : '💾 Save Variant'}
                </button>
              </form>
            </div>
          )}

          {/* Comparison Matrix Table */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">⚖️ Vaulted Variants Comparison ({vaultItems.length})</h4>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewScope('all')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    viewScope === 'all' 
                      ? 'bg-white text-hue-navy shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🌐 All Saved Vaults Across Sessions
                </button>
                <button
                  onClick={() => setViewScope('current')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                    viewScope === 'current' 
                      ? 'bg-white text-hue-navy shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📌 Current Session Only
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-10 text-slate-400 text-sm">Loading schedule vault...</div>
            ) : vaultItems.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                No saved schedule variants in your vault yet. Save a variant above to start comparing options!
              </div>
            ) : (
              <div className="table-container border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="table-header">
                    <tr>
                      <th className="py-3 px-4 text-left">Variant Name</th>
                      <th className="py-3 px-3 text-center">Saved Date</th>
                      <th className="py-3 px-3 text-center">Exams</th>
                      <th className="py-3 px-3 text-center">Days Used</th>
                      <th className="py-3 px-3 text-center">Violations</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {vaultItems.map((item) => {
                      const schedData = item.schedule_data || {};
                      const examCount = schedData.schedule?.length || 0;
                      const datesUsed = [...new Set(schedData.schedule?.map(x => x.exam_date) || [])].length;
                      const violations = item.violation_count || schedData.violations?.length || 0;
                      const formattedDate = new Date(item.created_at).toLocaleString();

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-hue-navy">
                            {item.name}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {formattedDate}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">
                            {examCount}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-600">
                            {datesUsed} days
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`badge ${violations > 0 ? 'badge-danger font-bold' : 'badge-success font-bold'}`}>
                              {violations} {violations === 1 ? 'violation' : 'violations'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  onSelectSchedule(schedData, item.locked_assignments);
                                  onClose();
                                }}
                                className="btn btn-secondary btn-sm text-[11px] py-1 px-3 border-hue-gold/60 text-hue-navy hover:bg-hue-gold/15 font-bold"
                              >
                                👁️ Load / Activate
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="text-red-400 hover:text-red-600 px-2 py-1 text-sm transition-colors"
                                title="Delete from Vault"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button className="btn btn-secondary text-xs" onClick={onClose}>
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleVaultModal;

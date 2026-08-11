import { useState, useEffect } from 'react';
import axios from 'axios';

function UserManagementModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // New user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Faculty Staff');
  const [department, setDepartment] = useState('Faculty of Pharmacy');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/auth/users');
      if (res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user account '${username}'?`)) return;

    try {
      setError('');
      setSuccessMsg('');
      const res = await axios.delete(`/api/auth/users/${userId}`);
      if (res.data.success) {
        setSuccessMsg(`User account '${username}' deleted successfully.`);
        fetchUsers();
      } else {
        setError(res.data.error || 'Failed to delete user.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username || !password || !name) {
      setError('Username, password, and full name are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await axios.post('/api/auth/register', {
        username,
        password,
        name,
        role,
        department
      });

      if (res.data.success) {
        setSuccessMsg(`User account '${username}' created successfully!`);
        setUsername('');
        setPassword('');
        setName('');
        setShowAddForm(false);
        fetchUsers();
      } else {
        setError(res.data.error || 'Failed to create user account.');
      }
    } catch (err) {
      console.error('Create user error:', err);
      setError(err.response?.data?.error || 'An error occurred while creating the user account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="p-5 bg-[#0B1E36] text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <h3 className="text-lg font-bold text-white font-outfit">Authorized User Accounts</h3>
              <p className="text-slate-400 text-xs mt-0.5">Manage users allowed to access the Final Exam Scheduler.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="m-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div className="m-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            ✅ {successMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          
          {/* Supabase Access Note */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex justify-between items-center gap-2">
            <div>
              <span className="font-bold">⚡ Supabase Database Sync:</span> All accounts created below are instantly synchronized to your Supabase PostgreSQL database to grant application access.
            </div>
            <a
              href="/api/auth/export-sql"
              download="supabase_users_access.sql"
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-lg text-[11px] font-bold shrink-0 transition-colors"
            >
              📥 Export SQL for Supabase
            </a>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              System Accounts ({users.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-primary btn-sm font-semibold text-xs"
            >
              {showAddForm ? 'Cancel' : '➕ Add New Account'}
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
              <h4 className="font-bold text-xs text-[#0B1E36] dark:text-amber-400 uppercase tracking-wider">Create New Authorized User</h4>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Ahmed Hassan"
                    className="input input-sm h-9 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. ahmed_control"
                    className="input input-sm h-9 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set password"
                    className="input input-sm h-9 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input input-sm h-9 w-full font-medium"
                  >
                    <option value="Admin">Admin (Full Access)</option>
                    <option value="Control Committee">Control Committee</option>
                    <option value="Faculty Staff">Faculty Staff</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-gold btn-sm font-bold"
                >
                  {submitting ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* User List Table */}
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading accounts...</div>
          ) : (
            <div className="table-container border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 text-left">User</th>
                    <th className="p-3 text-left">Username</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-left">Department</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0B1E36] text-[#D4AF37] flex items-center justify-center text-xs font-black">
                          {u.name.charAt(0)}
                        </div>
                        {u.name}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{u.username}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'Admin' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800' :
                          u.role === 'Control Committee' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                          'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{u.department}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-800 rounded-lg transition-colors"
                          title="Delete user account"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>Horus University — Egypt Authentication Framework</span>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default UserManagementModal;

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LOGO_HUE = '/assets/logo_hue.png';
const LOGO_PHARMACY = '/assets/logo_pharmacy.png';
const LOGO_DTU = '/assets/logo_dtu.png';

function Login() {
  const { login, loading, error, setError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in both username and password.');
      return;
    }
    await login(username, password);
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
    login(u, p);
  };

  return (
    <div className="min-h-screen bg-[#0B1E36] text-white flex flex-col justify-between p-4 relative overflow-hidden select-none">
      
      {/* Background Subtle Graphic Grids */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:24px_24px]"></div>

      {/* Top Header Branding Bar */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 py-4 z-10 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg shadow-md border border-white/20">
            <img src={LOGO_HUE} alt="Horus University Egypt Logo" className="h-10 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide text-white font-outfit uppercase">
              HORUS UNIVERSITY — EGYPT (HUE)
            </h1>
            <p className="text-[11px] text-[#D4AF37] font-semibold tracking-wider uppercase">
              FACULTY OF PHARMACY • DIGITAL TRANSFORMATION UNIT (DTU)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded-full border border-white/20">
            <img src={LOGO_PHARMACY} alt="Faculty of Pharmacy Seal" className="h-10 w-10 object-contain" title="NAQAAE Accredited" />
          </div>
          <div className="bg-white/10 p-1.5 rounded-md border border-white/20">
            <img src={LOGO_DTU} alt="DTU Logo" className="h-10 w-auto object-contain" title="Digital Transformation Unit" />
          </div>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center py-8 z-10">
        <div className="w-full max-w-md animate-fade-in">
          
          {/* Main Card */}
          <div className="bg-white text-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200/80 relative">
            
            {/* Top Security Banner */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#0B1E36] to-[#15345C] text-[#D4AF37] rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg border border-[#D4AF37]/30 mb-3">
                🛡️
              </div>
              <h2 className="text-2xl font-black text-[#0B1E36] tracking-tight font-outfit">
                Authorized Login
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Enter your credentials to access the Final Exam Scheduler.
              </p>
            </div>

            {/* Error Callout */}
            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2.5 animate-shake">
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter account username (e.g., admin)"
                    className="w-full h-11 px-3.5 pl-10 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]/30 focus:border-[#0B1E36] transition-all font-medium"
                    required
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                    👤
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-11 px-3.5 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1E36]/30 focus:border-[#0B1E36] transition-all font-medium"
                    required
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                    🔑
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-[#0B1E36] focus:ring-[#0B1E36]"
                  />
                  Keep me signed in
                </label>
                <span className="text-slate-400 text-[11px]">Control System v2.0</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-gradient-to-r from-[#0B1E36] to-[#163863] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#0B1E36]/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>🔐 Sign In to Control System</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Accounts Selection */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Quick Login Shortcuts (Authorized Roles)
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin', 'admin123')}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-[#0B1E36] hover:text-white border border-slate-200 text-[11px] font-bold transition-all text-slate-700 group flex flex-col items-center gap-1"
                >
                  <span className="text-sm">👑</span>
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('control', 'control123')}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-[#0B1E36] hover:text-white border border-slate-200 text-[11px] font-bold transition-all text-slate-700 group flex flex-col items-center gap-1"
                >
                  <span className="text-sm">📜</span>
                  <span>Exam Control</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('pharmacy', 'pharmacy123')}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-[#0B1E36] hover:text-white border border-slate-200 text-[11px] font-bold transition-all text-slate-700 group flex flex-col items-center gap-1"
                >
                  <span className="text-sm">🎓</span>
                  <span>Faculty Staff</span>
                </button>
              </div>
            </div>

          </div>

          {/* Footer Security Badge */}
          <div className="text-center mt-4 text-slate-400 text-[11px] flex items-center justify-center gap-2">
            <span>🛡️ Protected by HUE Security Framework</span>
            <span>•</span>
            <span>NAQAAE Certified</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto py-3 text-center text-slate-400 text-xs border-t border-white/10 z-10">
        Horus University — Egypt (HUE) • Faculty of Pharmacy • Digital Transformation Unit (DTU)
      </footer>

    </div>
  );
}

export default Login;

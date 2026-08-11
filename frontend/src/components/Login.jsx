import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, loading, error, setError } = useAuth();
  const [username, setUsername] = useState('melkhodary@horus.edu.eg');
  const [password, setPassword] = useState('admin123');

  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in both Email Address and Password.');
      return;
    }
    await login(username, password);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4 font-sans select-none relative transition-colors">
      
      {/* Centered Main Login Card */}
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 md:p-10 border border-slate-100 dark:border-slate-800 animate-fade-in relative z-10">
        
        {/* Brand Shield Logo Header */}
        <div className="flex flex-col items-center justify-center text-center">
          
          {/* Official Session Master Image Logo */}
          <div className="flex justify-center mb-1">
            <img 
              src="/assets/session_master_shield_logo.png" 
              alt="Session Master Logo" 
              className="h-28 md:h-32 w-auto object-contain"
            />
          </div>

          {/* Subtitle */}
          <div className="text-[10px] font-extrabold text-[#EAB308] uppercase tracking-widest mt-1">
            FINAL EXAM MAKER
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-4 mb-1 font-outfit">
            Welcome Back
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-[280px] leading-relaxed">
            Sign In to access the Horus University Exam Management System
          </p>

        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2.5 animate-shake">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          
          {/* Email / Username Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                ✉️
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="melkhodary@horus.edu.eg"
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#EBF3FE] dark:bg-slate-800 border border-blue-100/80 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full h-12 pl-11 pr-11 rounded-2xl bg-[#EBF3FE] dark:bg-slate-800 border border-blue-100/80 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-3 bg-[#0A192F] hover:bg-[#001835] text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>

        </form>

      </div>

    </div>
  );
}

export default Login;

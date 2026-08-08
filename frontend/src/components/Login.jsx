import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const { login, loading, error, setError } = useAuth();
  const [username, setUsername] = useState('melkhodary@horus.edu.eg');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in both Email Address and Password.');
      return;
    }
    await login(username, password);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center p-4 font-sans select-none relative">
      
      {/* Centered Main Login Card */}
      <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-xl p-8 md:p-10 border border-slate-100 animate-fade-in relative z-10">
        
        {/* Brand Shield Logo Header */}
        <div className="flex flex-col items-center justify-center text-center">
          
          {/* Shield Icon Graphic */}
          <div className="relative mb-2">
            <svg className="w-20 h-20 text-[#EAB308]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Shield Outline */}
              <path d="M50 8L85 24V48C85 70 70 88 50 94C30 88 15 70 15 48V24L50 8Z" fill="#FFFBEB" stroke="#EAB308" strokeWidth="4" strokeLinejoin="round" />
              {/* Gold Grid Network Nodes */}
              <path d="M35 32L50 24L65 32L65 48L50 56L35 48Z" stroke="#EAB308" strokeWidth="2.5" strokeDasharray="2 2" />
              <path d="M50 24V56M35 32L65 48M65 32L35 48" stroke="#EAB308" strokeWidth="2" />
              <circle cx="50" cy="24" r="3.5" fill="#0B1E36" />
              <circle cx="35" cy="32" r="3.5" fill="#0B1E36" />
              <circle cx="65" cy="32" r="3.5" fill="#0B1E36" />
              <circle cx="35" cy="48" r="3.5" fill="#0B1E36" />
              <circle cx="65" cy="48" r="3.5" fill="#0B1E36" />
              {/* Center Checkmark Emblem */}
              <circle cx="50" cy="40" r="11" fill="#EAB308" />
              <path d="M44 40L48 44L56 36" stroke="#0B1E36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-xl font-black tracking-tight text-[#EAB308] uppercase font-outfit m-0">
            SESSION MASTER
          </h1>
          <div className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">
            FINAL EXAM MAKER
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-black text-slate-900 mt-5 mb-1 font-outfit">
            Welcome Back
          </h2>
          <p className="text-slate-500 text-xs font-medium max-w-[260px] leading-relaxed">
            Sign In to access the Horus University Exam Supervision System
          </p>

        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium flex items-center gap-2.5 animate-shake">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          
          {/* Email / Username Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#EBF3FE] border border-blue-100/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white transition-all font-medium"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔒
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#EBF3FE] border border-blue-100/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white transition-all font-medium"
                required
              />
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

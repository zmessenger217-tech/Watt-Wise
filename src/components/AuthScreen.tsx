import React, { useState } from 'react';
import { Eye, EyeOff, Zap, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';

export const AuthScreen: React.FC = () => {
  const {
    loginWithEmail,
    signUpWithEmail,
    resetPasswordForEmail,
  } = useWattWise();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const switchMode = (nextMode: 'signin' | 'signup' | 'forgot') => {
    setMode(nextMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'forgot') {
        if (password.length < 6) {
          setErrorMessage('New password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('New password and confirmation password do not match.');
          setIsSubmitting(false);
          return;
        }
        const msg = await resetPasswordForEmail(trimmedEmail, password);
        setSuccessMessage(msg);
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
      } else if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match. Please confirm your password.');
          setIsSubmitting(false);
          return;
        }
        await signUpWithEmail(name, trimmedEmail, password);
      } else {
        if (!password) {
          setErrorMessage('Please enter your password.');
          setIsSubmitting(false);
          return;
        }
        await loginWithEmail(trimmedEmail, password);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7FB] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Brand & Energy Illustration Column */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#071A3E] via-[#0B275A] to-[#0D3B7A] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 30% 75%, #22C55E 0%, transparent 45%), radial-gradient(circle at 80% 25%, #3B82F6 0%, transparent 50%)',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D63ED] flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Zap className="w-6 h-6 text-white fill-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">WattWise</h1>
                <p className="text-sm text-blue-200 font-medium">Smart Electricity Management</p>
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3 leading-snug">
              Monitor. Manage. Save.
            </h2>
            <p className="text-blue-100/85 text-sm md:text-base leading-relaxed max-w-md">
              Take control of your electricity usage, track multiple meters independently, set monthly unit limits, and receive smart device alerts before your bill spikes.
            </p>
          </div>

          {/* Vector Energy Bulb + Consumption Graph Artwork */}
          <div className="relative z-10 my-8 flex flex-col items-center justify-center">
            <svg
              viewBox="0 0 360 220"
              className="w-full max-w-[340px] h-auto drop-shadow-lg"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="25" y="135" width="16" height="55" rx="3" fill="#1E40AF" fillOpacity="0.55" />
              <rect x="50" y="115" width="16" height="75" rx="3" fill="#1D4ED8" fillOpacity="0.65" />
              <rect x="75" y="95" width="16" height="95" rx="3" fill="#2563EB" fillOpacity="0.75" />
              <rect x="265" y="120" width="16" height="70" rx="3" fill="#1D4ED8" fillOpacity="0.65" />
              <rect x="290" y="90" width="16" height="100" rx="3" fill="#2563EB" fillOpacity="0.75" />
              <rect x="315" y="65" width="16" height="125" rx="3" fill="#3B82F6" fillOpacity="0.85" />

              <path
                d="M15 165 L65 130 L115 142 L180 95 L245 110 L300 62 L345 35"
                stroke="#38BDF8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="65" cy="130" r="4" fill="#38BDF8" />
              <circle cx="180" cy="95" r="4" fill="#38BDF8" />
              <circle cx="300" cy="62" r="4" fill="#38BDF8" />
              <circle cx="345" cy="35" r="5" fill="#4ADE80" />

              <circle cx="180" cy="105" r="58" fill="#22C55E" fillOpacity="0.12" />
              <path
                d="M180 38C151.281 38 128 61.2812 128 90C128 108.65 137.82 124.99 152.6 134.15C157.8 137.38 161 143.12 161 149.25V158C161 162.418 164.582 166 169 166H191C195.418 166 199 162.418 199 158V149.25C199 143.12 202.2 137.38 207.4 134.15C222.18 124.99 232 108.65 232 90C232 61.2812 208.719 38 180 38Z"
                fill="#0F2952"
                stroke="#60A5FA"
                strokeWidth="3.5"
              />
              <path
                d="M180 135V85M180 105C180 86 198 74 206 74C206 92 195 105 180 105ZM180 115C180 99 164 88 156 88C156 103 166 115 180 115Z"
                stroke="#4ADE80"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="165" y="172" width="30" height="6" rx="3" fill="#93C5FD" />
              <rect x="170" y="182" width="20" height="6" rx="3" fill="#60A5FA" />
              <ellipse cx="180" cy="198" rx="95" ry="10" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.5" />
            </svg>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs text-blue-100/90">
            <div>
              <div className="font-bold text-white text-sm">Multi-Meter</div>
              <div>Independent tracking</div>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Smart Alerts</div>
              <div>50% to 100%+ limits</div>
            </div>
            <div>
              <div className="font-bold text-white text-sm">Device Push</div>
              <div>OS Notification Bar</div>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-center bg-white">
          {/* Top Sign In / Sign Up Tabs */}
          <div className="flex border-b border-slate-200 mb-7">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 pb-3.5 text-sm font-semibold transition-colors relative cursor-pointer ${
                mode === 'signin'
                  ? 'text-[#1D63ED]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
              {mode === 'signin' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D63ED] rounded-full" />
              )}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 pb-3.5 text-sm font-semibold transition-colors relative cursor-pointer ${
                mode === 'signup'
                  ? 'text-[#1D63ED]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
              {mode === 'signup' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D63ED] rounded-full" />
              )}
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'signin'
                ? 'Welcome Back!'
                : mode === 'signup'
                ? 'Create Your Account'
                : 'Reset Your Password'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'signin'
                ? 'Sign in with your registered email and password'
                : mode === 'signup'
                ? 'Register a new account to start monitoring your electricity meters'
                : 'Enter your registered email and set a new password'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] focus:ring-2 focus:ring-blue-500/15 outline-none transition-all text-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] focus:ring-2 focus:ring-blue-500/15 outline-none transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {mode === 'forgot' ? 'New Password *' : 'Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'signin'
                      ? 'Enter your password'
                      : 'At least 6 characters'
                  }
                  required
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] focus:ring-2 focus:ring-blue-500/15 outline-none transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(mode === 'signup' || mode === 'forgot') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {mode === 'forgot' ? 'Confirm New Password *' : 'Confirm Password *'}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] focus:ring-2 focus:ring-blue-500/15 outline-none transition-all text-slate-900"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#1D63ED] focus:ring-[#1D63ED]"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-semibold text-[#1D63ED] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] active:bg-[#1245AC] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Please wait...</span>
              ) : mode === 'signin' ? (
                <span>Sign In</span>
              ) : mode === 'signup' ? (
                <span>Create Account</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="mt-7 text-center text-xs text-slate-500">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-[#1D63ED] hover:underline cursor-pointer"
                >
                  Create Account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-semibold text-[#1D63ED] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

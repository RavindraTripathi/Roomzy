import React, { useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck, X } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

type AuthTab = 'google' | 'email' | 'phone' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const [tab, setTab] = useState<AuthTab>('google');
  const [isRegister, setIsRegister] = useState(initialMode === 'signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    setError(null);
    setInfo(null);
  }, [tab, isRegister, isOpen]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const formatFirebaseAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'This sign-in method is not yet enabled in Firebase Console (Authentication -> Sign-in method). Please enable it in Firebase Console or continue with Google Sign-In.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in popup was closed before completion.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Invalid email or password. Please check and try again.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if (code === 'auth/invalid-phone-number') {
      return 'Enter a valid Indian phone number with +91 country code (e.g., +919876543210).';
    }
    return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      onClose();
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (isRegister) {
        if (fullName.trim().length < 2) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: fullName.trim() });
        await sendEmailVerification(cred.user);
        setInfo('Account created! Please check your inbox and click the verification link to unlock full profile features.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onClose();
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter your registered email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const normalized = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim().replace(/^0+/, '')}`;
      if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: 'invisible',
        });
      }
      const result = await signInWithPhoneNumber(auth, normalized, recaptchaVerifierRef.current!);
      setConfirmationResult(result);
      setInfo(`OTP sent to ${normalized}.`);
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    setError(null);
    try {
      await confirmationResult.confirm(otp.trim());
      onClose();
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 relative shadow-xl">
        <button
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="text-xl font-bold tracking-tight text-slate-900 font-display">ROOMZY</div>
          <h2 className="text-2xl font-bold text-slate-900 mt-2">
            {tab === 'forgot' ? 'Reset your password' : isRegister ? 'Create your ROOMZY account' : 'Welcome back to ROOMZY'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Find verified flatmates and shared apartments across India.
          </p>
        </div>

        {/* Method Tabs */}
        {tab !== 'forgot' && (
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setTab('google')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setTab('phone')}
              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phone OTP
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{info}</span>
          </div>
        )}

        {tab === 'google' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#ffffff"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                />
              </svg>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 justify-center pt-1">
              <ShieldCheck className="w-4 h-4 text-violet-700" />
              <span>Instant verified identity & encrypted session</span>
            </div>
          </div>
        )}

        {tab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.in"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">Password</label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setTab('forgot')}
                    className="text-xs font-medium text-violet-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Mail className="w-4 h-4" />
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In with Email'}
            </button>
            <p className="text-center text-xs text-slate-600 pt-1">
              {isRegister ? 'Already have an account?' : 'New to ROOMZY?'}{' '}
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="font-semibold text-violet-700 hover:underline"
              >
                {isRegister ? 'Sign In' : 'Create an Account'}
              </button>
            </p>
          </form>
        )}

        {tab === 'phone' && (
          <div className="space-y-4">
            {!confirmationResult ? (
              <form onSubmit={handleSendOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Indian Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Phone className="w-4 h-4" />
                  {loading ? 'Sending OTP...' : 'Send Verification OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm transition-colors disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify OTP & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationResult(null)}
                  className="w-full text-xs text-slate-600 hover:text-slate-900"
                >
                  Change phone number
                </button>
              </form>
            )}
            <div ref={recaptchaContainerRef} />
          </div>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <button
              type="button"
              onClick={() => setTab('email')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </button>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Registered Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.in"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Password Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

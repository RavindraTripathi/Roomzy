import React, { useState } from 'react';
import { User, sendEmailVerification } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  FlatmateProfile,
  UserAccount,
  VerificationRecord,
} from '../types/roomzy';

interface ProfileAndVerificationProps {
  user: User;
  profile: FlatmateProfile | null;
  account: UserAccount | null;
  verifications: VerificationRecord[];
  onEditOnboarding: () => void;
  onLogout: () => Promise<void>;
  activeSection: 'profile' | 'verification';
}

export const ProfileAndVerification: React.FC<ProfileAndVerificationProps> = ({
  user,
  profile,
  account,
  verifications,
  onEditOnboarding,
  onLogout,
  activeSection,
}) => {
  const [docType, setDocType] = useState<'Aadhaar' | 'PAN' | 'Passport' | 'Driving License'>('Aadhaar');
  const [docNumber, setDocNumber] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [kycMsg, setKycMsg] = useState<string | null>(null);
  const [kycErr, setKycErr] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);

  const handleToggleVisibility = async () => {
    if (!profile) return;
    setTogglingVisibility(true);
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        isActive: !profile.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${user.uid}`);
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleResendEmailVerification = async () => {
    setKycErr(null);
    setKycMsg(null);
    try {
      await sendEmailVerification(user);
      setKycMsg('Verification email sent to your inbox.');
    } catch (err) {
      setKycErr(err instanceof Error ? err.message : 'Unable to send verification email.');
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingKyc(true);
    setKycErr(null);
    setKycMsg(null);

    try {
      const resp = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: docType,
          documentNumber: docNumber,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setKycErr(data.error || 'KYC validation failed.');
        setSubmittingKyc(false);
        return;
      }

      // Store ONLY masked last-4 reference & pending status; never store full Aadhaar/PAN
      await addDoc(collection(db, 'verifications'), {
        uid: user.uid,
        type: 'govt_id',
        provider: data.provider || 'compliance_queue',
        documentType: docType,
        documentLast4: data.documentLast4,
        status: 'pending',
        notes: 'Submitted for verification; raw ID masked server-side.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setDocNumber('');
      setKycMsg(data.message);
    } catch (err) {
      setKycErr(err instanceof Error ? err.message : 'Failed to submit verification.');
    } finally {
      setSubmittingKyc(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {activeSection === 'profile' && profile && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 overflow-hidden flex items-center justify-center shrink-0">
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-violet-700">
                    {profile.fullName[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">
                    {profile.fullName}, {profile.age}
                  </h1>
                  {profile.isVerified && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {profile.profession}
                  {profile.companyOrCollege ? ` · ${profile.companyOrCollege}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onEditOnboarding}
                className="h-10 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold"
              >
                Edit Profile & Preferences
              </button>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div><span className="text-slate-500 block">Preferred City</span><strong className="text-slate-900">{profile.preferredCity}</strong></div>
            <div><span className="text-slate-500 block">Locality</span><strong className="text-slate-900">{profile.preferredLocality}</strong></div>
            <div><span className="text-slate-500 block">Monthly Budget</span><strong className="text-slate-900 font-mono-num">₹{profile.monthlyBudget.toLocaleString('en-IN')}</strong></div>
            <div><span className="text-slate-500 block">Move-in Date</span><strong className="text-slate-900">{profile.moveInDate}</strong></div>
            <div><span className="text-slate-500 block">Occupancy</span><strong className="text-slate-900">{profile.occupancyPreference}</strong></div>
            <div><span className="text-slate-500 block">Food Preference</span><strong className="text-slate-900">{profile.foodPreference}</strong></div>
            <div><span className="text-slate-500 block">Sleep Schedule</span><strong className="text-slate-900">{profile.sleepSchedule}</strong></div>
            <div><span className="text-slate-500 block">Work Mode</span><strong className="text-slate-900">{profile.workMode}</strong></div>
            <div><span className="text-slate-500 block">Cleanliness</span><strong className="text-slate-900">{profile.cleanliness}</strong></div>
            <div><span className="text-slate-500 block">Smoking / Drinking</span><strong className="text-slate-900">{profile.smoking} / {profile.drinking}</strong></div>
            <div><span className="text-slate-500 block">Pets</span><strong className="text-slate-900">{profile.pets}</strong></div>
            <div><span className="text-slate-500 block">Guests & Parties</span><strong className="text-slate-900">{profile.guestPreference} · {profile.partyFrequency}</strong></div>
          </div>

          {profile.aboutMe && (
            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 mb-1">About Me</div>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.aboutMe}</p>
            </div>
          )}

          {/* Privacy Control */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <EyeOff className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Discovery Visibility</div>
                <div className="text-xs text-slate-500">
                  {profile.isActive
                    ? 'Your profile is currently visible to compatible flatmates.'
                    : 'Your profile is paused and hidden from Discover.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={togglingVisibility}
              onClick={() => void handleToggleVisibility()}
              className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-900 shrink-0"
            >
              {profile.isActive ? 'Pause Visibility' : 'Resume Visibility'}
            </button>
          </div>
        </div>
      )}

      {/* Verification & Safety Center */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Identity Verification & Safety</h2>
            <p className="text-sm text-slate-600 mt-1">
              Build trust with potential flatmates. Aadhaar, PAN, and contact details are strictly private and never shown publicly.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-100 text-slate-800 capitalize">
            {account?.verificationStatus || 'unverified'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-violet-700" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Email Verification</div>
                <div className="text-xs text-slate-500">{user.email || 'Not linked'}</div>
              </div>
            </div>
            {user.emailVerified ? (
              <span className="text-xs font-semibold text-emerald-700">Verified</span>
            ) : (
              <button
                type="button"
                onClick={() => void handleResendEmailVerification()}
                className="text-xs font-semibold text-violet-700 hover:underline"
              >
                Verify Email
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-violet-700" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Phone Verification</div>
                <div className="text-xs text-slate-500">{user.phoneNumber || 'Sign in with Phone OTP'}</div>
              </div>
            </div>
            <span className={`text-xs font-semibold ${user.phoneNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
              {user.phoneNumber ? 'Verified' : 'Optional'}
            </span>
          </div>
        </div>

        <form onSubmit={handleKycSubmit} className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileCheck2 className="w-4 h-4 text-violet-700" />
            Government ID Verification (Masked KYC)
          </div>

          {kycErr && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {kycErr}
            </div>
          )}
          {kycMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              {kycMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as typeof docType)}
              className="h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="Aadhaar">Aadhaar (12 digits)</option>
              <option value="PAN">PAN Card</option>
              <option value="Passport">Indian Passport</option>
              <option value="Driving License">Driving License</option>
            </select>
            <input
              type="text"
              required
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder={docType === 'Aadhaar' ? '12-digit Aadhaar number' : 'Document ID number'}
              className="h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono-num"
            />
            <button
              type="submit"
              disabled={submittingKyc}
              className="h-11 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submittingKyc && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit for Verification
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Security guarantee: Your full ID number is validated and truncated to its last 4 characters server-side. Raw Aadhaar/PAN numbers are never stored in Firestore or displayed to users.
          </p>
        </form>

        {verifications.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="text-xs font-semibold text-slate-500">Your Verification Submissions</div>
            {verifications.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0">
                <span>
                  {v.documentType} {v.documentLast4 ? `(•••• ${v.documentLast4})` : ''} · {v.provider}
                </span>
                <span className="font-semibold capitalize text-slate-900">{v.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Safety Guidelines */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
            <span>Always tour apartments in daylight or with a friend before transferring any token amount or security deposit.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-violet-700 shrink-0 mt-0.5" />
            <span>Keep early conversations inside ROOMZY chat until you have verified the flatmate and property details.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

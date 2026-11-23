import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Check, ShieldAlert, UserCheck, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatINR } from '../lib/compatibility';
import {
  FlatmateProfile,
  PropertyListing,
  SafetyReport,
  UserAccount,
  VerificationRecord,
} from '../types/roomzy';

interface AdminDashboardProps {
  adminUid: string;
  profiles: FlatmateProfile[];
  listings: PropertyListing[];
}

interface SubRecord {
  id: string;
  uid: string;
  plan: string;
  amountInr: number;
  status: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUid,
  profiles,
  listings,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubRecord[]>([]);
  const [tab, setTab] = useState<'users' | 'verifications' | 'listings' | 'reports'>('users');

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserAccount));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubVer = onSnapshot(
      collection(db, 'verifications'),
      (snap) => {
        setVerifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'verifications')
    );

    const unsubRep = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SafetyReport, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
    );

    const unsubSub = onSnapshot(
      collection(db, 'subscriptions'),
      (snap) => {
        setSubscriptions(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    return () => {
      unsubUsers();
      unsubVer();
      unsubRep();
      unsubSub();
    };
  }, []);

  const totalRevenue = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((acc, s) => acc + (s.amountInr || 0), 0);

  const handleToggleBan = async (u: UserAccount) => {
    await updateDoc(doc(db, 'users', u.uid), {
      isBanned: !u.isBanned,
      updatedAt: serverTimestamp(),
    });
    if (profiles.some((p) => p.uid === u.uid)) {
      await updateDoc(doc(db, 'profiles', u.uid), {
        isActive: u.isBanned,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleToggleSuspend = async (u: UserAccount) => {
    await updateDoc(doc(db, 'users', u.uid), {
      isSuspended: !u.isSuspended,
      updatedAt: serverTimestamp(),
    });
  };

  const handleVerificationDecision = async (v: VerificationRecord, decision: 'verified' | 'rejected') => {
    if (!v.id) return;
    await updateDoc(doc(db, 'verifications', v.id), {
      status: decision,
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'users', v.uid), {
      verificationStatus: decision,
      updatedAt: serverTimestamp(),
    });
    if (profiles.some((p) => p.uid === v.uid)) {
      await updateDoc(doc(db, 'profiles', v.uid), {
        isVerified: decision === 'verified',
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleModerateListing = async (l: PropertyListing, status: PropertyListing['status']) => {
    if (!l.id) return;
    await updateDoc(doc(db, 'property_listings', l.id), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const handleResolveReport = async (r: SafetyReport, status: 'resolved' | 'dismissed') => {
    if (!r.id) return;
    await updateDoc(doc(db, 'reports', r.id), {
      status,
      resolvedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin & Trust Console</h1>
        <p className="text-sm text-slate-600">
          Live platform telemetry, KYC verification approvals, listing moderation, and safety reports.
        </p>
      </div>

      {/* Live Aggregates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs text-slate-500">Registered Users</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono-num mt-1">{users.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {profiles.filter((p) => p.isActive).length} active discovery profiles
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs text-slate-500">Total Listings</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono-num mt-1">{listings.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {listings.filter((l) => l.status === 'active').length} live on marketplace
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs text-slate-500">Pending KYC / Reports</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono-num mt-1">
            {verifications.filter((v) => v.status === 'pending').length} /{' '}
            {reports.filter((r) => r.status === 'open').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting moderator action</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs text-slate-500">Subscriptions & Revenue</div>
          <div className="text-2xl font-extrabold text-violet-700 font-mono-num mt-1">
            {formatINR(totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {users.filter((u) => u.subscriptionTier === 'premium').length} active Plus members
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto">
        {(['users', 'verifications', 'listings', 'reports'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tables */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {tab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Plan</th>
                  <th className="py-3 px-4 font-semibold">Verification</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-slate-500">{u.email || u.phone || u.uid}</div>
                    </td>
                    <td className="py-3 px-4 capitalize">{u.subscriptionTier}</td>
                    <td className="py-3 px-4 capitalize">{u.verificationStatus}</td>
                    <td className="py-3 px-4">
                      {u.isBanned ? 'Banned' : u.isSuspended ? 'Suspended' : 'Active'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleToggleSuspend(u)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-medium"
                      >
                        {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleBan(u)}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-medium"
                      >
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'verifications' && (
          <div className="divide-y divide-slate-100">
            {verifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <UserCheck className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                No KYC verification requests submitted yet.
              </div>
            ) : (
              verifications.map((v) => (
                <div key={v.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {v.documentType} {v.documentLast4 ? `(•••• ${v.documentLast4})` : ''}
                    </div>
                    <div className="text-slate-500">
                      UID: {v.uid} · Status: <strong className="capitalize">{v.status}</strong>
                    </div>
                  </div>
                  {v.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleVerificationDecision(v, 'verified')}
                        className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleVerificationDecision(v, 'rejected')}
                        className="h-8 px-3 rounded-lg border border-rose-200 text-rose-700 font-semibold inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'listings' && (
          <div className="divide-y divide-slate-100">
            {listings.map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">{l.title}</div>
                  <div className="text-slate-500">
                    {l.locality}, {l.city} · {formatINR(l.monthlyRent)}/mo · Status: {l.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.status !== 'moderation_removed' ? (
                    <button
                      type="button"
                      onClick={() => void handleModerateListing(l, 'moderation_removed')}
                      className="h-8 px-3 rounded-lg border border-rose-200 text-rose-700 font-semibold"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleModerateListing(l, 'active')}
                      className="h-8 px-3 rounded-lg border border-slate-200 text-slate-800 font-semibold"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                <ShieldAlert className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                No safety reports filed.
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {r.reason} ({r.targetType})
                    </div>
                    <div className="text-slate-500">
                      Target: {r.targetId} · Status: {r.status}
                    </div>
                    {r.details && <p className="text-slate-600 mt-1">{r.details}</p>}
                  </div>
                  {r.status === 'open' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleResolveReport(r, 'resolved')}
                        className="h-8 px-3 rounded-lg bg-slate-900 text-white font-semibold"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResolveReport(r, 'dismissed')}
                        className="h-8 px-3 rounded-lg border border-slate-200 text-slate-700 font-semibold"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

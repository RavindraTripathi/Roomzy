import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { computeCompatibility, formatINR } from '../lib/compatibility';
import {
  AppTab,
  FlatmateProfile,
  MatchRecord,
  PropertyListing,
  UserAccount,
} from '../types/roomzy';

interface DashboardViewProps {
  me: FlatmateProfile | null;
  account: UserAccount | null;
  candidates: FlatmateProfile[];
  matches: MatchRecord[];
  listings: PropertyListing[];
  savedIds: Set<string>;
  recentlyViewedIds: string[];
  profilesByUid: Record<string, FlatmateProfile>;
  onNavigate: (tab: AppTab) => void;
  onOpenPremium: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  me,
  account,
  candidates,
  matches,
  listings,
  savedIds,
  recentlyViewedIds,
  profilesByUid,
  onNavigate,
  onOpenPremium,
}) => {
  const recommended = candidates
    .filter((p) => p.isActive && p.uid !== me?.uid)
    .map((p) => ({ profile: p, compat: computeCompatibility(me, p) }))
    .sort((a, b) => b.compat.score - a.compat.score)
    .slice(0, 3);

  const nearbyRooms = listings
    .filter(
      (l) =>
        l.status === 'active' &&
        (!me?.preferredCity || l.city.toLowerCase() === me.preferredCity.toLowerCase())
    )
    .slice(0, 3);

  const recentProfiles = recentlyViewedIds.map((uid) => profilesByUid[uid]).filter(Boolean).slice(0, 4);
  const savedProfiles = Array.from(savedIds).map((uid) => profilesByUid[uid]).filter(Boolean).slice(0, 4);
  const activeMatches = matches.filter((m) => m.status === 'matched');
  const completion = me?.profileCompletion ?? 0;

  return (
    <div className="space-y-8">
      {/* Welcome & Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {me?.fullName || account?.fullName || 'Flatmate'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {me
                  ? `Searching in ${me.preferredLocality}, ${me.preferredCity} · Budget ${formatINR(me.monthlyBudget)}/mo`
                  : 'Complete your profile to unlock compatibility scores.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('discover')}
              className="h-10 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              Start Swiping
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">Profile Completion</span>
              <span className="font-mono-num font-bold text-violet-700">{completion}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-700 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Membership Status</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 capitalize">
                {account?.subscriptionTier === 'premium'
                  ? `ROOMZY Plus (${account.subscriptionPlan})`
                  : 'Free Tier'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('verification')}
              className="text-xs font-semibold text-violet-700 hover:underline inline-flex items-center gap-1"
            >
              <ShieldCheck className="w-4 h-4" />
              {account?.verificationStatus === 'verified' ? 'KYC Verified' : 'Verify ID'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-600 font-mono-num">
              {activeMatches.length} Mutual Matches · {savedProfiles.length} Saved
            </span>
            {account?.subscriptionTier !== 'premium' && (
              <button
                type="button"
                onClick={onOpenPremium}
                className="h-9 px-3.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 font-semibold inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade Plus
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recommended Flatmates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recommended Flatmates</h2>
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            Open Discover Deck
          </button>
        </div>

        {recommended.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
            No other flatmate profiles are active yet. Check back as new members register in your city.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recommended.map(({ profile, compat }) => (
              <div
                key={profile.uid}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-700 font-mono-num">
                    {compat.label}
                  </span>
                  {profile.isVerified && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {profile.fullName}, {profile.age}
                  </h3>
                  <p className="text-xs text-slate-600">{profile.profession}</p>
                </div>
                <div className="text-xs text-slate-500">
                  {profile.preferredLocality}, {profile.preferredCity} ·{' '}
                  <span className="font-mono-num">{formatINR(profile.monthlyBudget)}/mo</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nearby Available Rooms */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Available Rooms {me?.preferredCity ? `in ${me.preferredCity}` : ''}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('rooms')}
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            Explore All Rooms
          </button>
        </div>

        {nearbyRooms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600 flex items-center justify-between gap-4">
            <span>No rooms listed in {me?.preferredCity || 'your city'} yet.</span>
            <button
              type="button"
              onClick={() => onNavigate('rooms')}
              className="h-9 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold shrink-0"
            >
              Browse All Cities
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {nearbyRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => onNavigate('rooms')}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 cursor-pointer hover:border-violet-300 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Building2 className="w-3.5 h-3.5 text-violet-700" />
                  <span>{room.locality}, {room.city}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{room.title}</h3>
                <div className="text-base font-extrabold text-violet-700 font-mono-num">
                  {formatINR(room.monthlyRent)}/mo
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Matches, Recently Viewed & Saved */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">New Matches</h3>
            <button
              type="button"
              onClick={() => onNavigate('matches')}
              className="text-xs font-semibold text-violet-700 hover:underline"
            >
              View All
            </button>
          </div>
          {activeMatches.length === 0 ? (
            <p className="text-xs text-slate-500 flex items-center gap-2 py-2">
              <Heart className="w-4 h-4 text-slate-400" />
              No mutual matches yet — swipe in Discover to connect.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeMatches.slice(0, 4).map((m) => {
                const partnerUid = m.users.find((u) => u !== me?.uid) || '';
                const partner = profilesByUid[partnerUid];
                if (!partner) return null;
                return (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{partner.fullName}</span>
                    <span className="font-mono-num text-violet-700 font-semibold">
                      {m.compatibilityScore}% Match
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Recently Viewed & Saved</h3>
          {recentProfiles.length === 0 && savedProfiles.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              Profiles you expand or bookmark in Discover will appear here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...recentProfiles, ...savedProfiles]
                .filter((p, idx, arr) => arr.findIndex((x) => x.uid === p.uid) === idx)
                .slice(0, 4)
                .map((p) => (
                  <div key={p.uid} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {p.fullName} · {p.preferredLocality}
                    </span>
                    <span className="font-mono-num text-slate-600">{formatINR(p.monthlyBudget)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

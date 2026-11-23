import React, { useState } from 'react';
import { Bookmark, CheckCircle2, Heart, Lock, MessageSquare, Sparkles } from 'lucide-react';
import { computeCompatibility, formatINR } from '../lib/compatibility';
import { FlatmateProfile, LikeRecord, MatchRecord, UserAccount } from '../types/roomzy';

interface MatchesAndLikesProps {
  me: FlatmateProfile | null;
  account: UserAccount | null;
  matches: MatchRecord[];
  incomingLikes: LikeRecord[];
  profilesByUid: Record<string, FlatmateProfile>;
  savedIds: Set<string>;
  onOpenChatWithMatch: (match: MatchRecord, partnerUid: string) => void;
  onAcceptIncomingLike: (fromProfile: FlatmateProfile) => Promise<void>;
  onToggleSave: (targetUid: string) => Promise<void>;
  onOpenPremium: () => void;
}

export const MatchesAndLikes: React.FC<MatchesAndLikesProps> = ({
  me,
  account,
  matches,
  incomingLikes,
  profilesByUid,
  savedIds,
  onOpenChatWithMatch,
  onAcceptIncomingLike,
  onToggleSave,
  onOpenPremium,
}) => {
  const [subTab, setSubTab] = useState<'matches' | 'liked_you' | 'saved'>('matches');
  const isPremium = account?.subscriptionTier === 'premium';

  const matchedUidSet = new Set(
    matches.flatMap((m) => m.users).filter((u) => u !== me?.uid)
  );
  const pendingIncoming = incomingLikes.filter(
    (l) => (l.type === 'like' || l.type === 'superlike') && !matchedUidSet.has(l.fromUid)
  );
  const savedProfiles = Array.from(savedIds)
    .map((uid) => profilesByUid[uid])
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matches & Connections</h1>
          <p className="text-sm text-slate-600">
            Mutual flatmate matches unlock private real-time chat.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab('matches')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'matches' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Matches ({matches.filter((m) => m.status === 'matched').length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('liked_you')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'liked_you' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Who Liked You ({pendingIncoming.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('saved')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'saved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Saved ({savedProfiles.length})
          </button>
        </div>
      </div>

      {subTab === 'matches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {matches.filter((m) => m.status === 'matched').length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <Heart className="w-8 h-8 text-violet-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No mutual matches yet</h3>
              <p className="text-sm text-slate-600 mt-1">
                Swipe right on compatible flatmates in Discover to create your first match.
              </p>
            </div>
          ) : (
            matches
              .filter((m) => m.status === 'matched')
              .map((m) => {
                const partnerUid = m.users.find((u) => u !== me?.uid) || '';
                const partner = profilesByUid[partnerUid];
                if (!partner) return null;

                return (
                  <div
                    key={m.id || partnerUid}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-violet-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {partner.photoUrl ? (
                          <img
                            src={partner.photoUrl}
                            alt={partner.fullName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-violet-700">
                            {partner.fullName[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-bold text-slate-900 truncate">
                            {partner.fullName}, {partner.age}
                          </h3>
                          {partner.isVerified && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate">{partner.profession}</p>
                        <div className="text-xs text-slate-500 mt-1">
                          {partner.preferredLocality} ·{' '}
                          <span className="font-mono-num">{formatINR(partner.monthlyBudget)}/mo</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-violet-700 font-mono-num">
                        {m.compatibilityScore}% Lifestyle Match
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenChatWithMatch(m, partnerUid)}
                        className="h-10 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Message
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {subTab === 'liked_you' && (
        <div>
          {!isPremium ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {pendingIncoming.length === 0
                  ? 'See Who Liked Your Profile'
                  : `${pendingIncoming.length} flatmate${pendingIncoming.length > 1 ? 's' : ''} liked your profile`}
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Upgrade to ROOMZY Plus to see everyone who liked or Super Liked you and match instantly.
              </p>
              <button
                type="button"
                onClick={onOpenPremium}
                className="mt-5 h-11 px-5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Unlock Who Liked You
              </button>
            </div>
          ) : pendingIncoming.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <p className="text-sm text-slate-600">No pending incoming likes right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingIncoming.map((like) => {
                const sender = profilesByUid[like.fromUid];
                if (!sender) return null;
                const compat = computeCompatibility(me, sender);
                return (
                  <div
                    key={like.id || like.fromUid}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-violet-700 font-mono-num">
                          {compat.label}
                        </span>
                        {like.type === 'superlike' && (
                          <span className="text-xs font-semibold text-amber-700">Super Liked You</span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {sender.fullName}, {sender.age}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {sender.profession} · {sender.preferredLocality}, {sender.preferredCity}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onAcceptIncomingLike(sender)}
                      className="h-10 w-full rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold"
                    >
                      Match & Open Chat
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'saved' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedProfiles.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <Bookmark className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No saved profiles</h3>
              <p className="text-sm text-slate-600 mt-1">
                Tap the bookmark icon on any flatmate card in Discover to shortlist them here.
              </p>
            </div>
          ) : (
            savedProfiles.map((p) => {
              const compat = computeCompatibility(me, p);
              return (
                <div key={p.uid} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {p.fullName}, {p.age}
                      </h3>
                      <p className="text-xs text-slate-600">{p.profession}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onToggleSave(p.uid)}
                      className="text-xs text-slate-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-slate-600">
                    {p.preferredLocality}, {p.preferredCity} ·{' '}
                    <span className="font-mono-num">{formatINR(p.monthlyBudget)}/mo</span>
                  </div>
                  <div className="text-xs font-bold text-violet-700 font-mono-num">{compat.label}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

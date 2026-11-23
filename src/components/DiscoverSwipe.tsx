import React, { useMemo, useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import {
  Bookmark,
  CheckCircle2,
  Filter,
  Flag,
  Heart,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { computeCompatibility, formatINR } from '../lib/compatibility';
import {
  FlatmateProfile,
  INDIAN_CITIES,
  LikeRecord,
  UserAccount,
} from '../types/roomzy';

interface DiscoverSwipeProps {
  me: FlatmateProfile | null;
  account: UserAccount | null;
  candidates: FlatmateProfile[];
  myLikes: LikeRecord[];
  savedIds: Set<string>;
  blockedIds: Set<string>;
  onSwipe: (target: FlatmateProfile, type: 'like' | 'pass' | 'superlike') => Promise<void>;
  onToggleSave: (targetUid: string) => Promise<void>;
  onReportProfile: (target: FlatmateProfile) => void;
  onOpenPremium: () => void;
  onViewProfile: (target: FlatmateProfile) => void;
}

export const DiscoverSwipe: React.FC<DiscoverSwipeProps> = ({
  me,
  account,
  candidates,
  myLikes,
  savedIds,
  blockedIds,
  onSwipe,
  onToggleSave,
  onReportProfile,
  onOpenPremium,
  onViewProfile,
}) => {
  const [cityFilter, setCityFilter] = useState<string>('All');
  const [maxBudget, setMaxBudget] = useState<number>(80000);
  const [genderFilter, setGenderFilter] = useState<string>('All');
  const [foodFilter, setFoodFilter] = useState<string>('All');
  const [smokingFilter, setSmokingFilter] = useState<string>('All');
  const [sleepFilter, setSleepFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<FlatmateProfile | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [quotaNotice, setQuotaNotice] = useState<string | null>(null);

  const isPremium = account?.subscriptionTier === 'premium';
  const swipedSet = useMemo(() => new Set(myLikes.map((l) => l.toUid)), [myLikes]);

  const rankedDeck = useMemo(() => {
    return candidates
      .filter((p) => {
        if (!p.isActive || p.uid === me?.uid) return false;
        if (swipedSet.has(p.uid) || blockedIds.has(p.uid)) return false;
        if (cityFilter !== 'All' && p.preferredCity !== cityFilter) return false;
        if (p.monthlyBudget > maxBudget) return false;
        if (genderFilter !== 'All' && p.gender !== genderFilter) return false;
        if (isPremium) {
          if (foodFilter !== 'All' && p.foodPreference !== foodFilter) return false;
          if (smokingFilter !== 'All' && p.smoking !== smokingFilter) return false;
          if (sleepFilter !== 'All' && p.sleepSchedule !== sleepFilter) return false;
        }
        return true;
      })
      .map((p) => ({
        profile: p,
        compat: computeCompatibility(me, p),
      }))
      .sort((a, b) => {
        if (a.profile.isPriority !== b.profile.isPriority) {
          return a.profile.isPriority ? -1 : 1;
        }
        return b.compat.score - a.compat.score;
      });
  }, [
    candidates,
    me,
    swipedSet,
    blockedIds,
    cityFilter,
    maxBudget,
    genderFilter,
    isPremium,
    foodFilter,
    smokingFilter,
    sleepFilter,
  ]);

  const currentCard = rankedDeck[0] || null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLikesUsed = account?.lastLikeDate === todayStr ? account?.dailyLikesCount || 0 : 0;
  const dailyLimit = 10;

  const triggerSwipe = async (type: 'like' | 'pass' | 'superlike') => {
    if (!currentCard || busyAction) return;
    setQuotaNotice(null);

    if (!isPremium && type === 'like' && dailyLikesUsed >= dailyLimit) {
      setQuotaNotice('You have used all 10 daily likes on the Free plan. Upgrade to ROOMZY Plus for unlimited likes.');
      return;
    }

    if (type === 'superlike' && (account?.superLikesRemaining || 0) <= 0) {
      setQuotaNotice('No Super Likes remaining. Upgrade to ROOMZY Plus for monthly Super Likes.');
      return;
    }

    setBusyAction(true);
    try {
      await onSwipe(currentCard.profile, type);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 110) {
      void triggerSwipe('like');
    } else if (info.offset.x < -110) {
      void triggerSwipe('pass');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discover Flatmates</h1>
          <p className="text-sm text-slate-600">
            Ranked by lifestyle compatibility ·{' '}
            <span className="font-mono-num">
              {isPremium ? 'Unlimited daily likes' : `${Math.max(0, dailyLimit - dailyLikesUsed)}/${dailyLimit} free likes left today`}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="h-11 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-sm font-semibold text-slate-800 inline-flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4 text-violet-700" />
            Filters
          </button>
          {!isPremium && (
            <button
              type="button"
              onClick={onOpenPremium}
              className="h-11 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold whitespace-nowrap"
            >
              Upgrade Plus
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Filter className="w-4 h-4 text-violet-700" />
              Search Preferences
            </div>
            <button
              type="button"
              onClick={() => {
                setCityFilter('All');
                setMaxBudget(80000);
                setGenderFilter('All');
                setFoodFilter('All');
                setSmokingFilter('All');
                setSleepFilter('All');
              }}
              className="text-xs font-semibold text-violet-700 hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="All">All Indian Cities</option>
                {INDIAN_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Max Budget: <span className="font-mono-num font-semibold">{formatINR(maxBudget)}</span>
              </label>
              <input
                type="range"
                min={6000}
                max={80000}
                step={2000}
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
                className="w-full accent-violet-700 mt-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="All">Any Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-Binary">Non-Binary</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Advanced Lifestyle Filters (ROOMZY Plus)
              </span>
              {!isPremium && (
                <button
                  type="button"
                  onClick={onOpenPremium}
                  className="text-xs font-semibold text-violet-700 hover:underline"
                >
                  Unlock with Plus
                </button>
              )}
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${!isPremium ? 'opacity-50 pointer-events-none' : ''}`}>
              <select
                value={foodFilter}
                onChange={(e) => setFoodFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="All">Any Food Preference</option>
                <option value="Vegetarian">Vegetarian</option>
                <option value="Eggetarian">Eggetarian</option>
                <option value="Non-Vegetarian">Non-Vegetarian</option>
                <option value="Vegan">Vegan</option>
                <option value="Jain">Jain</option>
              </select>
              <select
                value={smokingFilter}
                onChange={(e) => setSmokingFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="All">Any Smoking Habit</option>
                <option value="Never">Non-Smoker Only</option>
                <option value="Socially">Socially</option>
              </select>
              <select
                value={sleepFilter}
                onChange={(e) => setSleepFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="All">Any Sleep Schedule</option>
                <option value="Early Bird">Early Bird</option>
                <option value="Balanced">Balanced</option>
                <option value="Night Owl">Night Owl</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {quotaNotice && (
        <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-violet-950 font-medium">{quotaNotice}</p>
          <button
            type="button"
            onClick={onOpenPremium}
            className="px-4 py-2 rounded-xl bg-violet-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            View ROOMZY Plus Plans
          </button>
        </div>
      )}

      {/* Main Swipe Stage */}
      {!currentCard ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-xl mx-auto">
          <h3 className="text-lg font-bold text-slate-900">No more profiles match your current filters</h3>
          <p className="text-sm text-slate-600 mt-2">
            Try expanding your monthly budget slider, switching target cities, or checking back soon as new flatmates join ROOMZY.
          </p>
          <button
            type="button"
            onClick={() => {
              setCityFilter('All');
              setMaxBudget(80000);
              setGenderFilter('All');
            }}
            className="mt-5 h-11 px-5 rounded-xl bg-violet-700 text-white text-sm font-semibold"
          >
            Reset Discovery Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive Swipe Card */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <motion.div
              key={currentCard.profile.uid}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm cursor-grab active:cursor-grabbing select-none"
            >
              <div className="relative h-80 bg-slate-100">
                {currentCard.profile.photoUrl ? (
                  <img
                    src={currentCard.profile.photoUrl}
                    alt={currentCard.profile.fullName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-100 via-slate-100 to-indigo-100 flex items-center justify-center">
                    <span className="text-5xl font-extrabold text-violet-700 font-display">
                      {currentCard.profile.fullName[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

                {/* Top Right Save + Report */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSave(currentCard.profile.uid)}
                    aria-label="Save profile"
                    className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                      savedIds.has(currentCard.profile.uid)
                        ? 'bg-violet-700 text-white'
                        : 'bg-white/85 text-slate-800 hover:bg-white'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReportProfile(currentCard.profile)}
                    aria-label="Report profile"
                    className="w-10 h-10 rounded-full bg-white/85 hover:bg-white text-slate-700 backdrop-blur-md flex items-center justify-center"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>

                {/* Compatibility Callout */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-violet-800 font-mono-num">
                  {currentCard.compat.label}
                </div>

                {/* Bottom Identity Overlay */}
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">
                      {currentCard.profile.fullName}, {currentCard.profile.age}
                    </h2>
                    {currentCard.profile.isVerified && (
                      <CheckCircle2
                        aria-label="Verified Identity"
                        className="w-5 h-5 text-emerald-400 shrink-0"
                      />
                    )}
                  </div>
                  <p className="text-sm text-white/90 mt-0.5">
                    {currentCard.profile.profession}
                    {currentCard.profile.companyOrCollege
                      ? ` · ${currentCard.profile.companyOrCollege}`
                      : ''}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-white/80 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {currentCard.profile.preferredLocality}, {currentCard.profile.preferredCity}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num font-semibold text-white">
                      {formatINR(currentCard.profile.monthlyBudget)}/mo
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-xs text-slate-600 leading-relaxed">
                  <span>{currentCard.profile.occupancyPreference}</span>
                  <span aria-hidden="true"> · </span>
                  <span>Move-in {currentCard.profile.moveInDate}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{currentCard.profile.foodPreference}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{currentCard.profile.sleepSchedule}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{currentCard.profile.workMode}</span>
                </div>

                {currentCard.profile.aboutMe && (
                  <p className="text-sm text-slate-700 line-clamp-2">{currentCard.profile.aboutMe}</p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setExpandedProfile(currentCard.profile);
                    onViewProfile(currentCard.profile);
                  }}
                  className="text-xs font-semibold text-violet-700 hover:underline"
                >
                  View full lifestyle breakdown
                </button>
              </div>
            </motion.div>

            {/* Thumb-Zone Swipe Action Controls */}
            <div className="flex items-center justify-center gap-4 mt-5">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void triggerSwipe('pass')}
                aria-label="Pass profile"
                className="w-14 h-14 rounded-full bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 text-slate-600 flex items-center justify-center shadow-sm transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <button
                type="button"
                disabled={busyAction}
                onClick={() => void triggerSwipe('superlike')}
                aria-label="Super Like profile"
                className="w-12 h-12 rounded-full bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-600 text-amber-500 flex items-center justify-center shadow-sm transition-colors"
                title={`Super Like (${account?.superLikesRemaining || 0} left)`}
              >
                <Star className="w-5 h-5" />
              </button>

              <button
                type="button"
                disabled={busyAction}
                onClick={() => void triggerSwipe('like')}
                aria-label="Like profile"
                className="w-14 h-14 rounded-full bg-violet-700 hover:bg-violet-800 text-white flex items-center justify-center shadow-md transition-colors"
              >
                <Heart className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Desktop Compatibility Detail Column */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Why you match</h3>
                <p className="text-xs text-slate-500">Live comparison with your preferences</p>
              </div>
              <span className="text-2xl font-extrabold text-violet-700 font-mono-num">
                {currentCard.compat.score}%
              </span>
            </div>

            {currentCard.compat.reasons.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">Strong Alignments</div>
                <ul className="space-y-1.5 text-sm text-slate-800">
                  {currentCard.compat.reasons.map((r) => (
                    <li key={r} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentCard.compat.mismatches.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500">Worth Discussing</div>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {currentCard.compat.mismatches.map((m) => (
                    <li key={m}>· {m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Cleanliness</span>
                <span className="font-semibold text-slate-900">{currentCard.profile.cleanliness}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Smoking / Drinking</span>
                <span className="font-semibold text-slate-900">
                  {currentCard.profile.smoking} / {currentCard.profile.drinking}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Pets</span>
                <span className="font-semibold text-slate-900">{currentCard.profile.pets}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Guests & Parties</span>
                <span className="font-semibold text-slate-900">
                  {currentCard.profile.guestPreference} · {currentCard.profile.partyFrequency}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Profile Detail Modal */}
      {expandedProfile && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    {expandedProfile.fullName}, {expandedProfile.age}
                  </h3>
                  {expandedProfile.isVerified && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {expandedProfile.profession}
                  {expandedProfile.companyOrCollege ? ` · ${expandedProfile.companyOrCollege}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedProfile(null)}
                className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {expandedProfile.aboutMe || 'No bio added yet.'}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-4">
              <div><span className="text-slate-500 block">Preferred Location</span><strong>{expandedProfile.preferredLocality}, {expandedProfile.preferredCity}</strong></div>
              <div><span className="text-slate-500 block">Monthly Budget</span><strong className="font-mono-num">{formatINR(expandedProfile.monthlyBudget)}</strong></div>
              <div><span className="text-slate-500 block">Move-in Date</span><strong>{expandedProfile.moveInDate}</strong></div>
              <div><span className="text-slate-500 block">Occupancy</span><strong>{expandedProfile.occupancyPreference}</strong></div>
              <div><span className="text-slate-500 block">Food</span><strong>{expandedProfile.foodPreference}</strong></div>
              <div><span className="text-slate-500 block">Sleep</span><strong>{expandedProfile.sleepSchedule}</strong></div>
              <div><span className="text-slate-500 block">Work Mode</span><strong>{expandedProfile.workMode}</strong></div>
              <div><span className="text-slate-500 block">Cleanliness</span><strong>{expandedProfile.cleanliness}</strong></div>
              <div><span className="text-slate-500 block">Smoking / Drinking</span><strong>{expandedProfile.smoking} / {expandedProfile.drinking}</strong></div>
              <div><span className="text-slate-500 block">Pets</span><strong>{expandedProfile.pets}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

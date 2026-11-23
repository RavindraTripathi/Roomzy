import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Bell,
  Building2,
  Compass,
  Heart,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { DiscoverSwipe } from './components/DiscoverSwipe';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { MatchesAndLikes } from './components/MatchesAndLikes';
import { MessagesView } from './components/MessagesView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PremiumBillingModal } from './components/PremiumBillingModal';
import { ProfileAndVerification } from './components/ProfileAndVerification';
import { RoomsMarketplace } from './components/RoomsMarketplace';
import { computeCompatibility } from './lib/compatibility';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  ADMIN_EMAIL,
  AppNotification,
  AppTab,
  ConversationRecord,
  FlatmateProfile,
  LikeRecord,
  MatchRecord,
  PropertyListing,
  UserAccount,
  VerificationRecord,
} from './types/roomzy';

function MainApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [publicBrowseRooms, setPublicBrowseRooms] = useState(false);
  const [editingOnboarding, setEditingOnboarding] = useState(false);

  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<FlatmateProfile[]>([]);
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [outgoingLikes, setOutgoingLikes] = useState<LikeRecord[]>([]);
  const [incomingLikes, setIncomingLikes] = useState<LikeRecord[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumPlanInit, setPremiumPlanInit] = useState<'monthly' | 'quarterly' | 'annual' | 'featured_listing'>('quarterly');
  const [boostListingId, setBoostListingId] = useState<string | undefined>(undefined);

  const [matchCelebration, setMatchCelebration] = useState<{ partner: FlatmateProfile; score: number } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ uid: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState('Suspicious or fake profile');
  const [reportDetails, setReportDetails] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Real-time WebSocket state
  const wsRef = useRef<WebSocket | null>(null);
  const [onlineUids, setOnlineUids] = useState<Set<string>>(new Set());
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 4000);
  };

  // Listen for Google Maps Demo Key quota exceeded events
  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Fetch public server config (Maps API key fallback if injected at runtime)
  useEffect(() => {
    fetch('/api/config/public')
      .then((r) => r.json())
      .then((data: { mapsApiKey?: string }) => {
        if (data.mapsApiKey && !mapsApiKey) {
          setMapsApiKey(data.mapsApiKey);
        }
      })
      .catch(() => {});
  }, [mapsApiKey]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setAccount(null);
        setIsAdmin(false);
        return;
      }

      const emailVerifiedOrPhone = nextUser.emailVerified || Boolean(nextUser.phoneNumber);
      if (emailVerifiedOrPhone) {
        const userRef = doc(db, 'users', nextUser.uid);
        try {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              uid: nextUser.uid,
              ...(nextUser.email ? { email: nextUser.email } : {}),
              ...(nextUser.phoneNumber ? { phone: nextUser.phoneNumber } : {}),
              fullName: nextUser.displayName || 'ROOMZY Member',
              subscriptionTier: 'free',
              subscriptionPlan: 'none',
              superLikesRemaining: 1,
              dailyLikesCount: 0,
              verificationStatus: 'unverified',
              onboardingComplete: false,
              isSuspended: false,
              isBanned: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${nextUser.uid}`);
        }
      }

      // Check admin eligibility
      if (nextUser.email === ADMIN_EMAIL && nextUser.emailVerified) {
        setIsAdmin(true);
      } else {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', nextUser.uid));
          setIsAdmin(adminDoc.exists());
        } catch {
          setIsAdmin(false);
        }
      }
    });

    return () => unsub();
  }, []);

  // Public listings listener (works both for public room explorer and authenticated users)
  useEffect(() => {
    const q = query(collection(db, 'property_listings'), where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setListings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PropertyListing, 'id'>) }))
        );
      },
      (err) => {
        // Ignore if unauthenticated and no public listings yet
        console.warn('Listings snapshot:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // Authenticated Firestore real-time listeners
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubAccount = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setAccount(snap.data() as UserAccount);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );

    const unsubProfiles = onSnapshot(
      query(collection(db, 'profiles'), where('isActive', '==', true)),
      (snap) => {
        setProfiles(snap.docs.map((d) => d.data() as FlatmateProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    );

    const unsubOutLikes = onSnapshot(
      query(collection(db, 'likes'), where('fromUid', '==', user.uid)),
      (snap) => {
        setOutgoingLikes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LikeRecord, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'likes')
    );

    const unsubInLikes = onSnapshot(
      query(collection(db, 'likes'), where('toUid', '==', user.uid)),
      (snap) => {
        setIncomingLikes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LikeRecord, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'likes')
    );

    const unsubMatches = onSnapshot(
      query(collection(db, 'matches'), where('users', 'array-contains', user.uid)),
      (snap) => {
        setMatches(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MatchRecord, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'matches')
    );

    const unsubConvs = onSnapshot(
      query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid)),
      (snap) => {
        setConversations(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConversationRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const unsubSaved = onSnapshot(
      query(collection(db, 'saved_profiles'), where('ownerUid', '==', user.uid)),
      (snap) => {
        setSavedIds(new Set(snap.docs.map((d) => (d.data() as { targetUid: string }).targetUid)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'saved_profiles')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('uid', '==', user.uid)),
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubVer = onSnapshot(
      query(collection(db, 'verifications'), where('uid', '==', user.uid)),
      (snap) => {
        setVerifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'verifications')
    );

    // Real-time WebSocket connection for online presence & typing
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', uid: user.uid }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          uids?: string[];
          uid?: string;
          online?: boolean;
          conversationId?: string;
          isTyping?: boolean;
        };
        if (payload.type === 'presence:online_list' && payload.uids) {
          setOnlineUids(new Set(payload.uids));
        } else if (payload.type === 'presence:update' && payload.uid) {
          setOnlineUids((prev) => {
            const next = new Set(prev);
            if (payload.online) next.add(payload.uid!);
            else next.delete(payload.uid!);
            return next;
          });
        } else if (payload.type === 'typing' && payload.conversationId) {
          setTypingByConv((prev) => ({
            ...prev,
            [payload.conversationId!]: Boolean(payload.isTyping),
          }));
        }
      } catch {
        // ignore
      }
    };

    return () => {
      unsubAccount();
      unsubProfiles();
      unsubOutLikes();
      unsubInLikes();
      unsubMatches();
      unsubConvs();
      unsubSaved();
      unsubNotifs();
      unsubVer();
      ws.close();
      wsRef.current = null;
    };
  }, [authReady, user]);

  const profilesByUid = useMemo(() => {
    const dict: Record<string, FlatmateProfile> = {};
    for (const p of profiles) {
      dict[p.uid] = p;
    }
    return dict;
  }, [profiles]);

  const myProfile = user ? profilesByUid[user.uid] || null : null;

  const blockedIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) {
      if (m.status === 'blocked') {
        m.users.forEach((u) => {
          if (u !== user?.uid) s.add(u);
        });
      }
    }
    return s;
  }, [matches, user?.uid]);

  // --- Handlers ---
  const handleSwipe = async (target: FlatmateProfile, type: 'like' | 'pass' | 'superlike') => {
    if (!user || !account) return;
    const likeId = `${user.uid}_${target.uid}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentCount = account.lastLikeDate === todayStr ? account.dailyLikesCount : 0;

    await setDoc(doc(db, 'likes', likeId), {
      fromUid: user.uid,
      toUid: target.uid,
      type,
      createdAt: serverTimestamp(),
    });

    if (type === 'like' || type === 'superlike') {
      await updateDoc(doc(db, 'users', user.uid), {
        dailyLikesCount: currentCount + 1,
        lastLikeDate: todayStr,
        ...(type === 'superlike'
          ? { superLikesRemaining: Math.max(0, (account.superLikesRemaining || 0) - 1) }
          : {}),
        updatedAt: serverTimestamp(),
      });

      // Notify recipient
      await addDoc(collection(db, 'notifications'), {
        uid: target.uid,
        type: 'like',
        title: type === 'superlike' ? 'Someone Super Liked you!' : 'New profile like',
        body: `${myProfile?.fullName || account.fullName} liked your ROOMZY profile.`,
        linkTab: 'matches',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // Check mutual like
      const reciprocal = incomingLikes.find(
        (l) => l.fromUid === target.uid && (l.type === 'like' || l.type === 'superlike')
      );
      if (reciprocal) {
        const sorted = [user.uid, target.uid].sort();
        const matchId = `${sorted[0]}_${sorted[1]}`;
        const compat = computeCompatibility(myProfile, target);

        await setDoc(doc(db, 'matches', matchId), {
          users: sorted,
          user1Uid: sorted[0],
          user2Uid: sorted[1],
          compatibilityScore: compat.score,
          status: 'matched',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'conversations', matchId), {
          participants: sorted,
          matchId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, 'notifications'), {
          uid: target.uid,
          type: 'match',
          title: "It's a Mutual Match!",
          body: `You and ${myProfile?.fullName || account.fullName} matched (${compat.score}% compatibility).`,
          linkTab: 'messages',
          isRead: false,
          createdAt: serverTimestamp(),
        });

        setMatchCelebration({ partner: target, score: compat.score });
      }
    }
  };

  const handleAcceptIncomingLike = async (fromProfile: FlatmateProfile) => {
    await handleSwipe(fromProfile, 'like');
    setActiveTab('matches');
  };

  const handleToggleSave = async (targetUid: string) => {
    if (!user) return;
    const saveId = `${user.uid}_${targetUid}`;
    if (savedIds.has(targetUid)) {
      await deleteDoc(doc(db, 'saved_profiles', saveId));
      showToast('Removed from saved profiles.');
    } else {
      await setDoc(doc(db, 'saved_profiles', saveId), {
        ownerUid: user.uid,
        targetUid,
        createdAt: serverTimestamp(),
      });
      showToast('Profile saved to your shortlist.');
    }
  };

  const handleOpenChatWithMatch = async (match: MatchRecord, partnerUid: string) => {
    if (!user) return;
    const convId = match.id || [user.uid, partnerUid].sort().join('_');
    const existingConv = conversations.find((c) => c.id === convId);
    if (!existingConv) {
      await setDoc(doc(db, 'conversations', convId), {
        participants: [user.uid, partnerUid].sort(),
        matchId: convId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setActiveConversationId(convId);
    setActiveTab('messages');
  };

  const handleContactOwner = async (listing: PropertyListing) => {
    if (!user || !listing.id) return;
    const participants = [user.uid, listing.ownerUid].sort();
    const convId = `room_${listing.id}_${participants.join('_')}`.slice(0, 120);
    const existingConv = conversations.find((c) => c.id === convId);
    if (!existingConv) {
      await setDoc(doc(db, 'conversations', convId), {
        participants,
        listingId: listing.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'notifications'), {
        uid: listing.ownerUid,
        type: 'inquiry',
        title: 'New Room Inquiry',
        body: `${myProfile?.fullName || account?.fullName || 'A ROOMZY user'} inquired about "${listing.title}".`,
        linkTab: 'messages',
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }
    setActiveConversationId(convId);
    setActiveTab('messages');
  };

  const handleBlockUser = async (conv: ConversationRecord, targetUid: string) => {
    if (!user || !conv.id) return;
    await updateDoc(doc(db, 'conversations', conv.id), {
      blockedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    if (conv.matchId) {
      await updateDoc(doc(db, 'matches', conv.matchId), {
        status: 'blocked',
        blockedBy: user.uid,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    showToast(`Blocked ${profilesByUid[targetUid]?.fullName || 'user'}.`);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportTarget) return;
    await addDoc(collection(db, 'reports'), {
      reporterUid: user.uid,
      targetUid: reportTarget.uid,
      targetType: 'user',
      targetId: reportTarget.uid,
      reason: reportReason,
      ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setReportTarget(null);
    setReportDetails('');
    showToast('Report submitted to ROOMZY Trust & Safety team.');
  };

  const handleSendTyping = (conversationId: string, targetUid: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId, targetUid, isTyping }));
    }
  };

  const handleNotifyMessageSent = (conversationId: string, targetUid: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message:sent', conversationId, targetUid }));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setPublicBrowseRooms(false);
    setActiveTab('discover');
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  // --- Quota Banner (Case A Google Maps Demo Key) ---
  const quotaBanner = gmpQuotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  if (!authReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-violet-700" />
          Loading ROOMZY...
        </div>
      </div>
    );
  }

  // Unauthenticated views: Landing Page or Public Rooms Marketplace
  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        {quotaBanner}
        {publicBrowseRooms ? (
          <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
                <button
                  type="button"
                  onClick={() => setPublicBrowseRooms(false)}
                  className="text-xl font-extrabold tracking-tight text-slate-900 font-display"
                >
                  ROOMZY
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPublicBrowseRooms(false)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('signin');
                      setAuthModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-violet-700 text-white text-sm font-semibold"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-6 py-8">
              <RoomsMarketplace
                currentUid={null}
                currentUserName=""
                currentUserVerified={false}
                listings={listings}
                mapsApiKey={mapsApiKey}
                onContactOwner={() => setAuthModalOpen(true)}
                onBoostListing={() => setAuthModalOpen(true)}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            </main>
          </div>
        ) : (
          <LandingPage
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
            onExploreRoomsPublic={() => setPublicBrowseRooms(true)}
          />
        )}

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      </div>
    );
  }

  // Email verification gate for unverified email/password signups
  const needsEmailVerification = !user.emailVerified && !user.phoneNumber;
  if (needsEmailVerification) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Verify your email address</h2>
          <p className="text-sm text-slate-600">
            We sent a verification link to <strong>{user.email}</strong>. Click the link in your inbox, then tap refresh below to continue onboarding.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-11 rounded-xl bg-violet-700 text-white text-sm font-semibold"
            >
              I Have Verified — Refresh
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(user);
                showToast('Verification email resent.');
              }}
              className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="text-xs text-slate-500 hover:text-slate-900 pt-1"
            >
              Sign out & use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banned account block
  if (account?.isBanned) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Account Suspended</h2>
          <p className="text-sm text-slate-600">
            Your ROOMZY account has been restricted by Trust & Safety moderation.
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Onboarding Wizard Gate
  if (account && (!account.onboardingComplete || !myProfile || editingOnboarding)) {
    return (
      <div>
        {quotaBanner}
        <OnboardingWizard
          user={user}
          existingProfile={myProfile}
          onComplete={() => {
            setEditingOnboarding(false);
            setActiveTab('discover');
            showToast('Profile updated! Your compatibility matches are ready.');
          }}
        />
      </div>
    );
  }

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: 'Discover', icon: <Compass className="w-5 h-5" /> },
    { id: 'matches', label: 'Matches', icon: <Heart className="w-5 h-5" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'rooms', label: 'Rooms', icon: <Building2 className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {quotaBanner}

      <div className="flex flex-1">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 p-5 justify-between sticky top-0 h-screen">
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="text-xl font-extrabold tracking-tight text-slate-900 font-display block text-left"
            >
              ROOMZY
            </button>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-violet-50 text-violet-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </button>

              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                    activeTab === item.id
                      ? 'bg-violet-50 text-violet-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setActiveTab('verification')}
                className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                  activeTab === 'verification'
                    ? 'bg-violet-50 text-violet-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                Safety & KYC
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`w-full h-11 px-3.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors ${
                    activeTab === 'admin'
                      ? 'bg-violet-50 text-violet-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  Admin Console
                </button>
              )}
            </nav>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            {account?.subscriptionTier !== 'premium' && (
              <button
                type="button"
                onClick={() => {
                  setPremiumPlanInit('quarterly');
                  setBoostListingId(undefined);
                  setPremiumModalOpen(true);
                }}
                className="w-full h-10 px-3.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Plus
              </button>
            )}
            <div className="text-xs text-slate-500 truncate px-1">
              {myProfile?.fullName || user.email}
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          {/* Compact Top Bar */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 px-4 sm:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="md:hidden text-lg font-extrabold tracking-tight text-slate-900 font-display">
                ROOMZY
              </span>
              <span className="hidden md:inline text-sm font-semibold text-slate-700 capitalize">
                {activeTab === 'verification' ? 'Identity Verification & Safety' : activeTab}
              </span>
            </div>

            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="md:hidden h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="md:hidden h-9 px-2.5 rounded-lg text-xs font-semibold text-violet-700 hover:bg-violet-50"
                >
                  Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-violet-700 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            if (n.id && !n.isRead) {
                              await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
                            }
                            if (n.linkTab) setActiveTab(n.linkTab as AppTab);
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left py-2.5 space-y-0.5 ${
                            !n.isRead ? 'font-semibold' : 'opacity-75'
                          }`}
                        >
                          <div className="text-xs text-slate-900">{n.title}</div>
                          <div className="text-[11px] text-slate-600">{n.body}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                me={myProfile}
                account={account}
                candidates={profiles}
                matches={matches}
                listings={listings}
                savedIds={savedIds}
                recentlyViewedIds={recentlyViewedIds}
                profilesByUid={profilesByUid}
                onNavigate={setActiveTab}
                onOpenPremium={() => {
                  setPremiumPlanInit('quarterly');
                  setBoostListingId(undefined);
                  setPremiumModalOpen(true);
                }}
              />
            )}

            {activeTab === 'discover' && (
              <DiscoverSwipe
                me={myProfile}
                account={account}
                candidates={profiles}
                myLikes={outgoingLikes}
                savedIds={savedIds}
                blockedIds={blockedIds}
                onSwipe={handleSwipe}
                onToggleSave={handleToggleSave}
                onReportProfile={(target) => setReportTarget({ uid: target.uid, name: target.fullName })}
                onOpenPremium={() => {
                  setPremiumPlanInit('quarterly');
                  setBoostListingId(undefined);
                  setPremiumModalOpen(true);
                }}
                onViewProfile={(target) =>
                  setRecentlyViewedIds((prev) => [target.uid, ...prev.filter((u) => u !== target.uid)])
                }
              />
            )}

            {activeTab === 'matches' && (
              <MatchesAndLikes
                me={myProfile}
                account={account}
                matches={matches}
                incomingLikes={incomingLikes}
                profilesByUid={profilesByUid}
                savedIds={savedIds}
                onOpenChatWithMatch={handleOpenChatWithMatch}
                onAcceptIncomingLike={handleAcceptIncomingLike}
                onToggleSave={handleToggleSave}
                onOpenPremium={() => {
                  setPremiumPlanInit('quarterly');
                  setBoostListingId(undefined);
                  setPremiumModalOpen(true);
                }}
              />
            )}

            {activeTab === 'messages' && (
              <MessagesView
                currentUid={user.uid}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={(id) => setActiveConversationId(id || null)}
                profilesByUid={profilesByUid}
                onlineUids={onlineUids}
                typingByConv={typingByConv}
                onSendTyping={handleSendTyping}
                onNotifyMessageSent={handleNotifyMessageSent}
                onBlockUser={handleBlockUser}
                onReportUser={(targetUid) =>
                  setReportTarget({
                    uid: targetUid,
                    name: profilesByUid[targetUid]?.fullName || 'User',
                  })
                }
              />
            )}

            {activeTab === 'rooms' && (
              <RoomsMarketplace
                currentUid={user.uid}
                currentUserName={myProfile?.fullName || account?.fullName || 'Owner'}
                currentUserVerified={Boolean(myProfile?.isVerified)}
                listings={listings}
                mapsApiKey={mapsApiKey}
                onContactOwner={handleContactOwner}
                onBoostListing={(listing) => {
                  setPremiumPlanInit('featured_listing');
                  setBoostListingId(listing.id);
                  setPremiumModalOpen(true);
                }}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            )}

            {(activeTab === 'profile' || activeTab === 'verification') && (
              <ProfileAndVerification
                user={user}
                profile={myProfile}
                account={account}
                verifications={verifications}
                onEditOnboarding={() => setEditingOnboarding(true)}
                onLogout={handleLogout}
                activeSection={activeTab === 'verification' ? 'verification' : 'profile'}
              />
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminDashboard adminUid={user.uid} profiles={profiles} listings={listings} />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (5 Tabs, <= 15% sticky height cap) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] ${
                active ? 'text-violet-700 font-semibold' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mutual Match Celebration Modal */}
      {matchCelebration && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="text-xs font-bold text-violet-700 font-mono-num">
              {matchCelebration.score}% Lifestyle Match
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900">It is a Match!</h3>
            <p className="text-sm text-slate-600">
              You and <strong>{matchCelebration.partner.fullName}</strong> both liked each other. Start chatting to discuss localities and budgets.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const sorted = [user.uid, matchCelebration.partner.uid].sort();
                  setActiveConversationId(`${sorted[0]}_${sorted[1]}`);
                  setMatchCelebration(null);
                  setActiveTab('messages');
                }}
                className="h-11 rounded-xl bg-violet-700 text-white text-sm font-semibold"
              >
                Send a Message
              </button>
              <button
                type="button"
                onClick={() => setMatchCelebration(null)}
                className="h-10 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Keep Swiping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReport}
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Report {reportTarget.name}</h3>
              <button type="button" onClick={() => setReportTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="Suspicious or fake profile">Suspicious or fake profile</option>
              <option value="Broker or commercial spam">Broker or commercial spam</option>
              <option value="Harassment or abusive messages">Harassment or abusive messages</option>
              <option value="Advance deposit scam">Advance deposit scam</option>
            </select>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Provide helpful context for our moderation team..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-4 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cashfree Premium Billing Modal */}
      <PremiumBillingModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        uid={user.uid}
        userEmail={user.email || ''}
        userName={myProfile?.fullName || account?.fullName || 'ROOMZY Member'}
        userPhone={user.phoneNumber || account?.phone || ''}
        initialPlan={premiumPlanInit}
        listingId={boostListingId}
        onPaymentVerified={(plan, expiresAt) => {
          showToast(`Payment verified (${plan}). Active until ${new Date(expiresAt).toLocaleDateString('en-IN')}.`);
        }}
      />

      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

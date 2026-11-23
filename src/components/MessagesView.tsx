import React, { useEffect, useRef, useState } from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Ban,
  Check,
  CheckCheck,
  Flag,
  ImagePlus,
  MessageSquare,
  Send,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ChatMessage, ConversationRecord, FlatmateProfile } from '../types/roomzy';

interface MessagesViewProps {
  currentUid: string;
  conversations: ConversationRecord[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  profilesByUid: Record<string, FlatmateProfile>;
  onlineUids: Set<string>;
  typingByConv: Record<string, boolean>;
  onSendTyping: (conversationId: string, targetUid: string, isTyping: boolean) => void;
  onNotifyMessageSent: (conversationId: string, targetUid: string) => void;
  onBlockUser: (conversation: ConversationRecord, targetUid: string) => Promise<void>;
  onReportUser: (targetUid: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUid,
  conversations,
  activeConversationId,
  onSelectConversation,
  profilesByUid,
  onlineUids,
  typingByConv,
  onSendTyping,
  onNotifyMessageSent,
  onBlockUser,
  onReportUser,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId) || null;
  const partnerUid = activeConv?.participants.find((p) => p !== currentUid) || '';
  const partnerProfile = profilesByUid[partnerUid];
  const isBlocked = Boolean(activeConv?.blockedBy);
  const partnerOnline = partnerUid ? onlineUids.has(partnerUid) : false;
  const partnerTyping = activeConv?.id ? Boolean(typingByConv[activeConv.id]) : false;

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const msgPath = `conversations/${activeConversationId}/messages`;
    const q = query(collection(db, msgPath), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        setMessages(list);

        // Mark unread incoming messages as read
        snap.docs.forEach((d) => {
          const data = d.data() as ChatMessage;
          if (data.senderUid !== currentUid && !data.readBy?.includes(currentUid)) {
            void updateDoc(doc(db, msgPath, d.id), {
              readBy: arrayUnion(currentUid),
            }).catch(() => {});
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, msgPath);
      }
    );

    return () => unsub();
  }, [activeConversationId, currentUid]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, partnerTyping]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!activeConv?.id || !partnerUid || isBlocked) return;
    onSendTyping(activeConv.id, partnerUid, val.length > 0);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      onSendTyping(activeConv.id!, partnerUid, false);
    }, 1800);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv?.id || isBlocked) return;
    const text = draft.trim();
    const img = imageUrl.trim();
    if (!text && !img) return;

    setSending(true);
    try {
      const msgPath = `conversations/${activeConv.id}/messages`;
      await addDoc(collection(db, msgPath), {
        senderUid: currentUid,
        ...(text ? { text } : {}),
        ...(img ? { imageUrl: img } : {}),
        readBy: [currentUid],
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'conversations', activeConv.id), {
        lastMessage: text || 'Shared an image',
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (partnerUid) {
        onSendTyping(activeConv.id, partnerUid, false);
        onNotifyMessageSent(activeConv.id, partnerUid);
      }

      setDraft('');
      setImageUrl('');
      setShowImageInput(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${activeConv.id}/messages`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-11rem)] min-h-[520px]">
      {/* Conversation List */}
      <div
        className={`md:col-span-4 border-r border-slate-200 flex flex-col ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Messages</h2>
          <p className="text-xs text-slate-500">Real-time chat with matches & room owners</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <MessageSquare className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              No conversations yet. Match with someone or inquire on a room listing!
            </div>
          ) : (
            conversations.map((conv) => {
              const otherUid = conv.participants.find((p) => p !== currentUid) || '';
              const other = profilesByUid[otherUid];
              const isOnline = onlineUids.has(otherUid);
              const isSelected = conv.id === activeConversationId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => conv.id && onSelectConversation(conv.id)}
                  className={`w-full p-4 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-violet-50/70' : ''
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {other?.photoUrl ? (
                      <img
                        src={other.photoUrl}
                        alt={other.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-violet-700">
                        {(other?.fullName || 'R')[0]?.toUpperCase()}
                      </span>
                    )}
                    {isOnline && (
                      <span
                        title="Online now"
                        className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {other?.fullName || 'ROOMZY Member'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {conv.blockedBy ? 'Conversation blocked' : conv.lastMessage || 'Say hello!'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Active Chat Thread */}
      <div
        className={`md:col-span-8 flex flex-col ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-700">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectConversation('')}
                  className="md:hidden text-xs font-semibold text-violet-700 px-2 py-1"
                >
                  Back
                </button>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {partnerProfile?.fullName || 'ROOMZY Member'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {partnerTyping ? (
                      <span className="text-violet-700 font-medium">Typing...</span>
                    ) : partnerOnline ? (
                      <span className="text-emerald-700 font-medium">Online</span>
                    ) : (
                      <span>Offline</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => partnerUid && void onBlockUser(activeConv, partnerUid)}
                  disabled={isBlocked}
                  className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {isBlocked ? 'Blocked' : 'Block'}
                </button>
                <button
                  type="button"
                  onClick={() => partnerUid && onReportUser(partnerUid)}
                  className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Report
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {messages.map((m) => {
                const mine = m.senderUid === currentUid;
                const readByPartner = partnerUid && m.readBy?.includes(partnerUid);
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? 'bg-violet-700 text-white'
                          : 'bg-white border border-slate-200 text-slate-900'
                      }`}
                    >
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="Shared attachment"
                          referrerPolicy="no-referrer"
                          className="rounded-xl max-h-56 object-cover mb-2"
                        />
                      )}
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      {mine && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/75">
                          {readByPartner ? (
                            <CheckCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {isBlocked ? (
              <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-600">
                Messaging is disabled because this conversation was blocked.
              </div>
            ) : (
              <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white space-y-2">
                {showImageInput && (
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Paste HTTPS image URL to share..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImageInput((v) => !v)}
                    aria-label="Share image URL"
                    className="w-11 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 shrink-0"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                  <button
                    type="submit"
                    disabled={sending || (!draft.trim() && !imageUrl.trim())}
                    className="h-11 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

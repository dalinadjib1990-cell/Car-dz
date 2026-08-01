import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Chat, Message } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Send, User, Search, MoreVertical, Phone, MessageSquare, Volume2, VolumeX, ArrowRight, CheckCircle2, Image as ImageIcon, Trash2, Edit2, X, Loader2, Bot, AlertTriangle, Eye } from 'lucide-react';
import { deleteSingleMessage, deleteFullChat } from '../services/chatService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Markdown from 'react-markdown';

import rehypeRaw from 'rehype-raw';

const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

function cleanMessageText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/style=["']color:\s*>\s*/gi, 'style="color: ')
    .replace(/color:\s*>\s*#/gi, 'color: #')
    .replace(/color:\s*>/gi, 'color:')
    .replace(/<span style="color:>\s*/gi, '<span style="color: ');
}

function AIMessageContent({ text }: { text: string }) {
  let displayText = cleanMessageText(text || '');
  let chartData: any = null;

  const jsonMatch = displayText.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.repairCosts) {
        chartData = parsed.repairCosts;
      }
      displayText = displayText.replace(jsonMatch[0], '');
    } catch (e) {}
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="markdown-body text-white/95 leading-relaxed text-sm md:text-base font-medium">
        <Markdown rehypePlugins={[rehypeRaw]}>{displayText}</Markdown>
      </div>
      {chartData && (
        <div className="w-full bg-black/40 rounded-xl p-4 md:p-5 border border-white/10 mt-4 shadow-xl">
          <h4 className="text-base md:text-lg font-bold text-white/90 mb-5 text-center flex items-center justify-center gap-2">
            <span className="w-6 h-[2px] bg-indigo-500 rounded-full"></span>
            مصاريف الترقيع المتوقعة
            <span className="w-6 h-[2px] bg-indigo-500 rounded-full"></span>
          </h4>
          <div className="flex flex-col gap-4">
            {chartData.map((item: any, index: number) => {
              const maxCost = Math.max(...chartData.map((d: any) => d.cost));
              const percentage = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
              return (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs md:text-sm font-bold">
                    <span className="text-white/80">{item.name}</span>
                    <span className="text-red-400 font-black bg-red-500/10 px-2 py-0.5 rounded text-[11px] md:text-xs">
                      {item.cost.toLocaleString()} دج
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 md:h-2.5 overflow-hidden flex justify-end">
                    <div 
                      className="bg-gradient-to-l from-red-500 to-rose-600 rounded-full h-full transition-all duration-1000 relative overflow-hidden"
                      style={{ width: `${percentage}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full -translate-x-full animate-shimmer"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Messages({ isWidget = false, initialChatId }: { isWidget?: boolean, initialChatId?: string | null }) {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const urlChatId = searchParams.get('chatId');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeAd, setActiveAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [assessingCar, setAssessingCar] = useState(false);
  const [msgToDelete, setMsgToDelete] = useState<Message | null>(null);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const touchTimerRef = React.useRef<any>(null);
  const typingTimeoutRef = React.useRef<any>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleTouchStartMsg = (msg: Message) => {
    touchTimerRef.current = setTimeout(() => {
      setMsgToDelete(msg);
    }, 450);
  };

  const handleTouchEndMsg = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const uids = new Set<string>();
      chats.forEach(c => {
        if (c.participants) {
          c.participants.forEach(uid => uids.add(uid));
        }
      });
      
      const newProfiles = { ...profiles };
      let changed = false;
      
      for (const uid of uids) {
        if (!newProfiles[uid]) {
          try {
            const d = await getDoc(doc(db, 'users', uid));
            if (d.exists()) {
              newProfiles[uid] = d.data();
              changed = true;
            }
          } catch (e) {
            console.error('Error fetching profile for', uid, e);
          }
        }
      }
      
      if (changed) {
        setProfiles(newProfiles);
      }
    };
    
    if (chats.length > 0) {
      fetchProfiles();
    }
  }, [chats]);

  const playNotificationSound = () => {
    if (soundEnabled) {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.play().catch(e => console.log('Sound play error:', e));
    }
  };

  useEffect(() => {
    if (activeChat?.adId) {
      const fetchAd = async () => {
        try {
          // 1. Check local storage
          const localAdsRaw = localStorage.getItem('market_auto_dz_local_ads');
          if (localAdsRaw) {
            const localAds = JSON.parse(localAdsRaw);
            const foundLocal = localAds.find((a: any) => a.id === activeChat.adId);
            if (foundLocal) {
              setActiveAd(foundLocal);
              return;
            }
          }

          // 2. Fetch from Firestore
          const adSnap = await getDoc(doc(db, 'ads', activeChat.adId));
          if (adSnap.exists()) {
            setActiveAd({ id: adSnap.id, ...adSnap.data() });
            return;
          }

          // 3. Fallback to activeChat metadata
          if (activeChat.adTitle || activeChat.adImage) {
            setActiveAd({
              id: activeChat.adId,
              title: activeChat.adTitle || 'سيارة معروضة في الماركت',
              price: activeChat.adPrice || 0,
              samouni: activeChat.adSamouni || 0,
              images: activeChat.adImage ? [activeChat.adImage] : [],
              wilaya: activeChat.adWilaya || 'الجزائر',
              status: activeChat.adStatus || 'active',
              description: 'إعلان سيارة من منصة ماركت أوتو الجزائر',
            });
          }
        } catch (error) {
          console.error('Error fetching ad for chat:', error);
          if (activeChat.adTitle || activeChat.adImage) {
            setActiveAd({
              id: activeChat.adId,
              title: activeChat.adTitle || 'سيارة معروضة في الماركت',
              price: activeChat.adPrice || 0,
              samouni: activeChat.adSamouni || 0,
              images: activeChat.adImage ? [activeChat.adImage] : [],
              wilaya: activeChat.adWilaya || 'الجزائر',
              status: activeChat.adStatus || 'active',
            });
          }
        }
      };
      fetchAd();
    } else if (activeChat?.adTitle) {
      setActiveAd({
        id: activeChat.id,
        title: activeChat.adTitle,
        price: activeChat.adPrice || 0,
        samouni: activeChat.adSamouni || 0,
        images: activeChat.adImage ? [activeChat.adImage] : [],
        wilaya: activeChat.adWilaya || 'الجزائر',
        status: activeChat.adStatus || 'active',
      });
    } else {
      setActiveAd(null);
    }
  }, [activeChat]);

  useEffect(() => {
    if (!user) return;
    
    const loadChats = () => {
      let localChats: Chat[] = [];
      try {
        const raw = localStorage.getItem('market_auto_dz_local_chats');
        if (raw) localChats = JSON.parse(raw);
      } catch (_) {}

      const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', user.uid)
      );
      
      const unsubChats = onSnapshot(q, (snap) => {
        let fsChats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));

        // Merge fsChats and localChats
        const chatMap = new Map<string, Chat>();
        localChats.forEach(c => chatMap.set(c.id, c));
        fsChats.forEach(c => chatMap.set(c.id, { ...chatMap.get(c.id), ...c }));

        let updatedChats = Array.from(chatMap.values());
        
        // Sort in memory
        updatedChats.sort((a, b) => {
          const getTime = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'string') return new Date(val).getTime();
            if (typeof val.toMillis === 'function') return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            return 0;
          };
          return getTime(b.updatedAt) - getTime(a.updatedAt);
        });

        snap.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const data = change.doc.data();
            if (data.lastMessage && data.updatedAt && data.lastSenderId !== user.uid) {
              playNotificationSound();
            }
          }
        });
        
        setChats(updatedChats);
        setLoading(false);
      }, (error) => {
        console.warn('Firestore chats query notice:', error);
        setChats(localChats);
        setLoading(false);
      });

      return unsubChats;
    };

    const unsub = loadChats();
    return () => { if (unsub) unsub(); };
  }, [user, soundEnabled]);

  useEffect(() => {
    const targetId = urlChatId || initialChatId;
    if (!targetId) return;

    const resolveTargetChat = async () => {
      // 1. Check existing chats array
      const targetInState = chats.find(c => c.id === targetId);
      if (targetInState) {
        if (activeChat?.id !== targetInState.id) {
          setActiveChat(targetInState);
        }
        return;
      }

      // 2. Check local storage
      try {
        const rawLocal = localStorage.getItem('market_auto_dz_local_chats');
        if (rawLocal) {
          const parsed: Chat[] = JSON.parse(rawLocal);
          const foundLocal = parsed.find(c => c.id === targetId);
          if (foundLocal) {
            setActiveChat(foundLocal);
            setChats(prev => {
              if (prev.some(c => c.id === foundLocal.id)) return prev;
              return [foundLocal, ...prev];
            });
            return;
          }
        }
      } catch (_) {}

      // 3. Direct Firestore fetch fallback
      try {
        const docSnap = await getDoc(doc(db, 'chats', targetId));
        if (docSnap.exists()) {
          const fetched = { id: docSnap.id, ...docSnap.data() } as Chat;
          setActiveChat(fetched);
          setChats(prev => {
            if (prev.some(c => c.id === fetched.id)) return prev;
            return [fetched, ...prev];
          });
        }
      } catch (e) {
        console.warn('Direct chat fetch notice:', e);
      }
    };

    resolveTargetChat();
  }, [urlChatId, initialChatId, chats.length]);

  useEffect(() => {
    if (!activeChat?.id || !user?.uid) {
      setIsOtherTyping(false);
      return;
    }
    const unsubChatDoc = onSnapshot(doc(db, 'chats', activeChat.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const otherUid = activeChat.participants?.find(id => id !== user.uid);
        if (otherUid && data.typing && data.typing[otherUid]) {
          setIsOtherTyping(true);
        } else {
          setIsOtherTyping(false);
        }
      }
    });
    return () => unsubChatDoc();
  }, [activeChat?.id, user?.uid]);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    let localMsgs: Message[] = [];
    try {
      const raw = localStorage.getItem(`market_auto_dz_local_msgs_${activeChat.id}`);
      if (raw) localMsgs = JSON.parse(raw);
    } catch (_) {}

    const q = query(
      collection(db, 'messages'), 
      where('chatId', '==', activeChat.id)
    );
    
    const unsubMessages = onSnapshot(q, (snap) => {
      let fsMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));

      // Merge and deduplicate
      const msgMap = new Map<string, Message>();
      localMsgs.forEach(m => msgMap.set(m.id, m));
      fsMsgs.forEach(m => msgMap.set(m.id, { ...msgMap.get(m.id), ...m }));

      let updatedMessages = Array.from(msgMap.values());
      
      // Sort in memory
      updatedMessages.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return Date.now();
          if (typeof val === 'string') return new Date(val).getTime();
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          return Date.now();
        };
        return getTime(a.createdAt) - getTime(b.createdAt);
      });

      setMessages(updatedMessages);
    }, (error) => {
      console.warn('Firestore messages subscription notice:', error);
      setMessages(localMsgs);
    });

    return () => unsubMessages();
  }, [activeChat?.id]);

  useEffect(() => {
    if (activeChat && user) {
      // 1. Clear unread count for current user in Firestore
      const chatRef = doc(db, 'chats', activeChat.id);
      setDoc(chatRef, {
        [`unreadCount.${user.uid}`]: 0
      }, { merge: true }).catch(console.error);

      // 2. Immediately update local React state for activeChat and chats list
      if (activeChat.unreadCount?.[user.uid]) {
        setActiveChat(prev => prev ? {
          ...prev,
          unreadCount: { ...(prev.unreadCount || {}), [user.uid]: 0 }
        } : prev);
      }

      setChats(prev => prev.map(c => {
        if (c.id === activeChat.id && c.unreadCount?.[user.uid]) {
          return {
            ...c,
            unreadCount: { ...(c.unreadCount || {}), [user.uid]: 0 }
          };
        }
        return c;
      }));

      // 3. Update localStorage and dispatch event for floating bubble / header
      try {
        const rawLocal = localStorage.getItem('market_auto_dz_local_chats');
        if (rawLocal) {
          const parsed: Chat[] = JSON.parse(rawLocal);
          let updated = false;
          const newParsed = parsed.map(c => {
            if (c.id === activeChat.id && c.unreadCount?.[user.uid]) {
              updated = true;
              return {
                ...c,
                unreadCount: { ...(c.unreadCount || {}), [user.uid]: 0 }
              };
            }
            return c;
          });
          if (updated) {
            localStorage.setItem('market_auto_dz_local_chats', JSON.stringify(newParsed));
          }
        }
      } catch (e) {}

      window.dispatchEvent(new Event('local-chats-updated'));

      // 4. Mark messages as read
      const unreadMessages = messages.filter(m => m.senderId !== user.uid && !m.read);
      unreadMessages.forEach(m => {
        setDoc(doc(db, 'messages', m.id), { read: true }, { merge: true }).catch(console.error);
      });
    }
  }, [activeChat?.id, user?.uid, messages.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    
    if (!activeChat || !user) return;
    
    const chatRef = doc(db, 'chats', activeChat.id);
    setDoc(chatRef, { [`typing.${user.uid}`]: true }, { merge: true }).catch(console.error);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(chatRef, { [`typing.${user.uid}`]: false }, { merge: true }).catch(console.error);
    }, 2500);
  };

  const handleSendMessage = async (e?: React.FormEvent, textOverride?: string, imageUrl?: string) => {
    if (e) e.preventDefault();
    const textToSend = (textOverride || newMessage || '').trim();
    if (!user || !activeChat || (!textToSend && !imageUrl)) return;

    if (!textOverride) setNewMessage('');

    const msgId = 'msg_' + Date.now();
    const nowIso = new Date().toISOString();

    const newMsgObj: Message = {
      id: msgId,
      chatId: activeChat.id,
      senderId: user.uid,
      text: textToSend,
      imageUrl: imageUrl || undefined,
      createdAt: nowIso,
      read: false,
    };

    // 1. Optimistic UI update
    setMessages(prev => [...prev, newMsgObj]);

    // 2. Local storage update
    try {
      const existing = JSON.parse(localStorage.getItem(`market_auto_dz_local_msgs_${activeChat.id}`) || '[]');
      localStorage.setItem(`market_auto_dz_local_msgs_${activeChat.id}`, JSON.stringify([...existing, newMsgObj]));

      const localChats = JSON.parse(localStorage.getItem('market_auto_dz_local_chats') || '[]');
      const updatedLocal = localChats.map((c: any) => {
        if (c.id === activeChat.id) {
          return {
            ...c,
            lastMessage: imageUrl ? '📷 صورة' : textToSend,
            lastSenderId: user.uid,
            updatedAt: nowIso,
          };
        }
        return c;
      });
      localStorage.setItem('market_auto_dz_local_chats', JSON.stringify(updatedLocal));
    } catch (_) {}

    // 3. Sync to Firestore in background
    try {
      const otherUid = activeChat.participants?.find(id => id !== user.uid);
      const chatRef = doc(db, 'chats', activeChat.id);
      
      setDoc(chatRef, { [`typing.${user.uid}`]: false }, { merge: true }).catch(console.error);

      await addDoc(collection(db, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        text: textToSend,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        read: false,
      });
      
      const updateData: any = {
        lastMessage: imageUrl ? '📷 صورة' : textToSend,
        lastSenderId: user.uid,
        updatedAt: serverTimestamp(),
      };
      
      if (otherUid) {
        updateData[`unreadCount.${otherUid}`] = (activeChat.unreadCount?.[otherUid] || 0) + 1;
      }
      
      await setDoc(chatRef, updateData, { merge: true });
    } catch (error) {
      console.warn('Background message sync notice:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'market_auto_dz');

    try {
      const res = await fetch('https://api.cloudinary.com/v1_1/dcegf2b44/image/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        await handleSendMessage(undefined, '', data.secure_url);
      }
    } catch (error) {
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = (msg: Message) => {
    setMsgToDelete(msg);
  };

  const handleConfirmDeleteMessage = async () => {
    if (!msgToDelete) return;
    try {
      await deleteSingleMessage(msgToDelete.id);
      setMessages(prev => prev.filter(m => m.id !== msgToDelete.id));
      toast.success('تم حذف الرسالة نهائياً للطرفين');
    } catch (error) {
      toast.error('فشل حذف الرسالة');
    } finally {
      setMsgToDelete(null);
    }
  };

  const handleConfirmDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      await deleteFullChat(chatToDelete.id);
      setChats(prev => prev.filter(c => c.id !== chatToDelete.id));
      if (activeChat?.id === chatToDelete.id) {
        setActiveChat(null);
      }
      toast.success('تم حذف المحادثة بالكامل');
    } catch (error) {
      toast.error('فشل حذف المحادثة');
    } finally {
      setChatToDelete(null);
    }
  };

  const handleEditMessage = async (msgId: string) => {
    if (!editText.trim()) return;
    try {
      await setDoc(doc(db, 'messages', msgId), { text: editText, edited: true }, { merge: true });
      setEditingMessageId(null);
      setEditText('');
      toast.success('تم تعديل الرسالة');
    } catch (error) {
      toast.error('فشل تعديل الرسالة');
    }
  };

  const handleAIAssessment = async () => {
    const adToAssess = activeAd || (activeChat?.adTitle ? {
      id: activeChat.adId || activeChat.id,
      title: activeChat.adTitle,
      price: activeChat.adPrice || 0,
      samouni: activeChat.adSamouni || 0,
      images: activeChat.adImage ? [activeChat.adImage] : [],
      wilaya: activeChat.adWilaya || 'الجزائر',
      status: activeChat.adStatus || 'active',
      description: `سيارة ${activeChat.adTitle || ''} معروضة بسعر ${activeChat.adPrice || 0} دج في السوق الجزائري.`,
    } : null);

    if (!adToAssess || !activeChat || !user) {
      toast.error('يرجى اختيار محادثة إعلان أولاً لتقييم السيارة');
      return;
    }
    setAssessingCar(true);
    const loadingToast = toast.loading('الخبير الآلي يحلل السيارة والسوق الجزائرية...');
    try {
      const isBuyer = user.uid === activeChat.buyerId;
      const role = isBuyer ? 'buyer' : 'seller';
      
      const response = await fetch('/api/gemini/assess-car', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adDetails: adToAssess,
          role,
          userMessage: 'أعطنا رأيك كخبير محايد في هذه السيارة وهذا السعر بناءً على خبرتك في السوق الجزائري، وحدد سعراً عادلاً للبائع والمشتري.',
        })
      });

      if (!response.ok) {
        let errMsg = 'فشل التقييم';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      
      const aiMsgObj: Message = {
        id: 'ai_' + Date.now(),
        chatId: activeChat.id,
        senderId: 'AI_EXPERT',
        text: data.reply,
        createdAt: new Date().toISOString(),
        read: false,
      };

      // Update state locally immediately
      setMessages(prev => [...prev, aiMsgObj]);

      // Save locally
      try {
        const localKey = `market_auto_dz_local_msgs_${activeChat.id}`;
        const rawMsgs = localStorage.getItem(localKey) || '[]';
        const parsedMsgs = JSON.parse(rawMsgs);
        parsedMsgs.push(aiMsgObj);
        localStorage.setItem(localKey, JSON.stringify(parsedMsgs));
      } catch (e) {}

      // Save to Firestore
      try {
        await addDoc(collection(db, 'messages'), {
          chatId: activeChat.id,
          senderId: 'AI_EXPERT',
          text: data.reply,
          createdAt: serverTimestamp(),
          read: false,
        });
      } catch (e) {
        console.warn('Firestore AI msg notice:', e);
      }

      const chatRef = doc(db, 'chats', activeChat.id);
      const otherUid = activeChat.participants?.find(id => id !== user.uid);
      const updateData: any = {
        lastMessage: '🤖 تقييم الخبير الآلي',
        lastSenderId: 'AI_EXPERT',
        updatedAt: serverTimestamp(),
      };
      if (otherUid) updateData[`unreadCount.${otherUid}`] = (activeChat.unreadCount?.[otherUid] || 0) + 1;
      
      try {
        await setDoc(chatRef, updateData, { merge: true });
      } catch (e) {}

      toast.success('تم إضافة تقييم الخبير الآلي بنجاح 🤖', { id: loadingToast });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'حدث خطأ أثناء الاتصال بالخبير الآلي', { id: loadingToast });
    } finally {
      setAssessingCar(false);
    }
  };

  const QUICK_REPLIES = [
    'كم السعر؟',
    'واش فيها معاود؟ (الطلاء)',
    'واش من بلاصة انت؟',
    'كيفاش حالة المحرك؟',
    'هل السيارة لا تزال متوفرة؟'
  ];

  if (!user) return null;

  return (
    <div className={`max-w-7xl w-full mx-auto px-0 md:px-4 ${isWidget ? 'h-full py-0' : 'h-[calc(100dvh-64px)] md:h-[calc(100vh-80px)] py-0 md:py-8'}`}>
      <div className="glass-card h-full flex overflow-hidden relative rounded-none md:rounded-2xl border-x-0 md:border-x">
        {/* Sidebar */}
        <div className={cn(
          "w-full md:w-80 border-l border-white/10 flex flex-col transition-all duration-300",
          activeChat ? "hidden md:flex" : "flex"
        )}>
          <div className="p-6 border-b border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">الرسائل</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/')}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
                  title="إغلاق"
                >
                  <X size={18} />
                </button>
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    soundEnabled ? "bg-brand-green/10 text-brand-green" : "bg-white/5 text-white/20"
                  )}
                  title={soundEnabled ? "إيقاف الصوت" : "تفعيل الصوت"}
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input type="text" placeholder="بحث في المحادثات..." className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pr-10 pl-4 text-base outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-white/20">جاري التحميل...</div>
            ) : chats.map(chat => (
              <div key={chat.id} className="relative group/chat">
                <button
                  onClick={() => setActiveChat(chat)}
                  className={cn(
                    "w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-right",
                    activeChat?.id === chat.id && "bg-white/5 border-r-4 border-brand-green"
                  )}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {(() => {
                      const otherUid = chat.participants?.find(id => id !== user.uid);
                      const otherProfile = otherUid ? profiles[otherUid] : null;
                      if (otherProfile?.photoURL) {
                        return <img src={otherProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                      }
                      return <User size={24} className="text-white/40" />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm truncate">
                        {(() => {
                          const otherUid = chat.participants?.find(id => id !== user.uid);
                          const otherProfile = otherUid ? profiles[otherUid] : null;
                          
                          if (otherProfile) {
                            return `${otherProfile.firstName || ''} ${otherProfile.lastName || ''}`.trim() || otherProfile.displayName || otherProfile.email?.split('@')[0];
                          }

                          const isBuyer = user.uid === chat.buyerId;
                          const otherName = isBuyer ? chat.sellerName : chat.buyerName;
                          const otherEmail = isBuyer ? chat.sellerEmail : chat.buyerEmail;
                          
                          if (otherName && !otherName.includes('undefined')) return otherName;
                          if (otherEmail) return otherEmail.split('@')[0];
                          return isBuyer ? 'بائع' : 'مشتري';
                        })()}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-white/20">
                          {(() => {
                            const val = chat.updatedAt;
                            if (!val) return '';
                            const date = typeof val.toDate === 'function' ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : null);
                            return date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                          })()}
                        </span>
                        {chat.unreadCount?.[user.uid] > 0 && (
                          <span className="bg-brand-green text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {chat.unreadCount[user.uid]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                        {(chat.adImage || activeAd?.images?.[0]) && (
                          <img src={chat.adImage || activeAd?.images?.[0]} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <p className="text-[10px] text-brand-green font-bold truncate flex-1">{chat.adTitle}</p>
                          {(chat.adStatus === 'sold' || (activeChat?.id === chat.id && activeAd?.status === 'sold')) ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">
                              تم البيع 🔴
                            </span>
                          ) : (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                              متوفر 🟢
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {chat.adPrice && <span className="text-[9px] text-emerald-400 font-bold">{chat.adPrice.toLocaleString()} دج</span>}
                        {chat.adSamouni && <span className="text-[9px] text-red-500 font-bold">سوموني: {chat.adSamouni.toLocaleString()}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-white/40 truncate mt-1">
                      {(() => {
                        const otherUid = chat.participants?.find(id => id !== user.uid);
                        if (otherUid && (chat as any).typing?.[otherUid]) {
                          return (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                              <span>يكتب الآن...</span>
                              <span className="inline-flex items-center gap-0.5">
                                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce"></span>
                              </span>
                            </span>
                          );
                        }
                        return chat.lastMessage || 'لا توجد رسائل بعد';
                      })()}
                    </p>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatToDelete(chat);
                  }}
                  className="absolute left-2 top-2 p-1.5 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover/chat:opacity-100 hover:bg-red-500/20 transition-all"
                  title="حذف المحادثة بالكامل"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {!loading && chats.length === 0 && (
              <div className="p-12 text-center text-white/20 text-sm">لا توجد محادثات نشطة</div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300 relative h-full min-w-0 min-h-0 w-full",
          !activeChat ? "hidden md:flex" : "flex"
        )}>
          {activeChat ? (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-[#0a0a0a]/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveChat(null)}
                    className="md:hidden p-2 hover:bg-white/5 rounded-lg text-white/40"
                  >
                    <ArrowRight size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center overflow-hidden shrink-0">
                    {(() => {
                      const otherUid = activeChat.participants?.find(id => id !== user.uid);
                      const otherProfile = otherUid ? profiles[otherUid] : null;
                      if (otherProfile?.photoURL) {
                        return <img src={otherProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                      }
                      return <User size={20} className="text-brand-green" />;
                    })()}
                  </div>
                  <div className="min-w-0 text-right flex-1">
                    <h3 className="font-bold text-sm truncate">
                      {(() => {
                        const otherUid = activeChat.participants?.find(id => id !== user.uid);
                        const otherProfile = otherUid ? profiles[otherUid] : null;
                        
                        if (otherProfile) {
                          return `${otherProfile.firstName || ''} ${otherProfile.lastName || ''}`.trim() || otherProfile.displayName || otherProfile.email?.split('@')[0];
                        }

                        const isBuyer = user.uid === activeChat.buyerId;
                        const otherName = isBuyer ? activeChat.sellerName : activeChat.buyerName;
                        const otherEmail = isBuyer ? activeChat.sellerEmail : activeChat.buyerEmail;
                        
                        if (otherName && !otherName.includes('undefined')) return otherName;
                        if (otherEmail) return otherEmail.split('@')[0];
                        return isBuyer ? 'بائع' : 'مشتري';
                      })()}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async () => {
                      if (!activeChat || !user) return;
                      const loadingToast = toast.loading('الخبير الآلي يراجع المحادثة...');
                      try {
                        const response = await fetch('/api/gemini/assess-car', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            adDetails: {
                              title: activeChat.adTitle || 'غير متوفر',
                              price: activeChat.adPrice || 0,
                              samouni: activeChat.adSamouni || 0,
                              wilaya: activeChat.adWilaya || 'غير متوفر'
                            },
                            role: 'viewer',
                            userMessage: 'أعطنا رأيك كخبير محايد في هذه المحادثة بين البائع والمشتري واقترح سعراً يرضي الطرفين.',
                          })
                        });
                  
                        if (!response.ok) {
                          let errMsg = 'فشل التقييم';
                          try {
                            const errData = await response.json();
                            if (errData.error) errMsg = errData.error;
                          } catch(e) {}
                          throw new Error(errMsg);
                        }
                        const data = await response.json();
                        
                        const aiMsgObj: Message = {
                          id: 'ai_' + Date.now(),
                          chatId: activeChat.id,
                          senderId: 'AI_EXPERT',
                          text: data.reply,
                          createdAt: new Date().toISOString(),
                          read: false,
                        };

                        setMessages(prev => [...prev, aiMsgObj]);

                        try {
                          const localKey = `market_auto_dz_local_msgs_${activeChat.id}`;
                          const rawMsgs = localStorage.getItem(localKey) || '[]';
                          const parsedMsgs = JSON.parse(rawMsgs);
                          parsedMsgs.push(aiMsgObj);
                          localStorage.setItem(localKey, JSON.stringify(parsedMsgs));
                        } catch (e) {}

                        try {
                          await addDoc(collection(db, 'messages'), {
                            chatId: activeChat.id,
                            senderId: 'AI_EXPERT',
                            text: data.reply,
                            createdAt: serverTimestamp(),
                            read: false,
                          });
                        } catch (e) {}

                        toast.success('تم إرسال رأي الخبير بنجاح', { id: loadingToast });
                      } catch (error: any) {
                        console.error(error);
                        toast.error(error.message || 'حدث خطأ أثناء الاتصال بالخبير الآلي', { id: loadingToast });
                      }
                    }}
                    className="p-2 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-colors text-indigo-500 flex items-center gap-2"
                    title="طلب رأي الخبير الآلي"
                  >
                    <Bot size={18} />
                    <span className="text-xs font-bold hidden md:inline">الخبير الآلي</span>
                  </button>
                  <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40"><Phone size={18} /></button>
                  <button 
                    onClick={() => setChatToDelete(activeChat)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-white/40 hover:text-red-400"
                    title="حذف المحادثة بالكامل"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => setActiveChat(null)}
                    className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors text-white/40"
                    title="إغلاق المحادثة"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Ad Banner inside Chat */}
              <div className="bg-white/5 border-b border-white/10 p-3 flex items-center justify-between gap-4">
                <div 
                  className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer flex-1 min-w-0" 
                  onClick={() => navigate(`/ad/${activeChat.adId}`)}
                >
                  {(activeChat.adImage || activeAd?.images?.[0]) ? (
                    <img src={activeChat.adImage || activeAd?.images?.[0]} alt={activeChat.adTitle} className="w-20 h-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-16 rounded-lg bg-black/50 flex items-center justify-center shrink-0">
                       <ImageIcon size={20} className="text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-brand-green line-clamp-1">{activeChat.adTitle || activeAd?.title}</p>
                      {(activeAd?.status === 'sold' || activeChat.adStatus === 'sold') ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse shrink-0">
                          تم البيع (Vendu) 🔴
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                          متوفر (Disponible) 🟢
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-emerald-400 font-black">
                        {(activeChat.adPrice || activeAd?.price)?.toLocaleString() || '---'} دج
                      </span>
                      {(activeChat.adSamouni || activeAd?.samouni) && (
                        <>
                          <span className="text-[10px] text-white/40">|</span>
                          <span className="text-xs text-red-500 font-black">
                            سوموني: {(activeChat.adSamouni || activeAd?.samouni).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleAIAssessment}
                  disabled={assessingCar}
                  className="flex items-center gap-2 bg-gradient-to-l from-indigo-600 to-indigo-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all shrink-0 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  title="اطلب رأي الخبير الآلي حول السعر والسيارة"
                >
                  {assessingCar ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  <span className="hidden sm:inline">تقييم الذكاء الاصطناعي</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full space-y-6">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                      <MessageSquare size={32} className="text-white/20" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-white/60 font-bold">ابدأ المحادثة الآن</p>
                      <p className="text-xs text-white/20">استخدم الرسائل السريعة بالأسفل للبدء</p>
                    </div>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === user.uid;
                  const isAI = msg.senderId === 'AI_EXPERT';
                  return (
                  <div 
                    key={msg.id} 
                    onTouchStart={() => handleTouchStartMsg(msg)}
                    onTouchEnd={handleTouchEndMsg}
                    onTouchCancel={handleTouchEndMsg}
                    className={cn(
                      "flex group relative w-full mb-6 items-end select-none",
                      isAI ? "justify-center" : (isMe ? "justify-start" : "justify-end")
                    )}
                  >
                    <div className="flex flex-col gap-1 max-w-[95%] md:max-w-[85%]">
                      <div className={cn(
                        "relative shadow-sm whitespace-pre-wrap leading-relaxed w-fit break-words cursor-pointer",
                        isAI 
                           ? "bg-[#12141a] text-white rounded-2xl border border-emerald-500/30 w-full p-4 md:p-6 shadow-2xl shadow-emerald-950/20 ring-1 ring-emerald-500/10" 
                          : (isMe
                            ? "bg-brand-green text-white rounded-[18px] rounded-tr-[4px] px-4 py-2.5 text-[15px]" 
                            : "bg-[#27272a] text-gray-100 rounded-[18px] rounded-tl-[4px] border border-white/5 px-4 py-2.5 text-[15px]")
                      )}>
                        {isAI && (
                          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
                                <Bot size={18} className="animate-pulse" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-sm md:text-base bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                                  الخبير الآلي (Market Auto DZ)
                                </h4>
                                <p className="text-[10px] text-white/40">تحليل ذكي ومحايد لسوق السيارات</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              استشارة خبير
                            </span>
                          </div>
                        )}
                        {editingMessageId === msg.id ? (
                          <div className="space-y-2 min-w-[200px]">
                            <input 
                              type="text" 
                              value={editText} 
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-base outline-none text-white focus:border-brand-green"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button onClick={() => setEditingMessageId(null)} className="px-3 py-1 text-xs text-white/50 hover:text-white bg-white/5 rounded-md transition-colors">إلغاء</button>
                              <button onClick={() => handleEditMessage(msg.id)} className="px-3 py-1 text-xs text-white bg-brand-green/80 hover:bg-brand-green rounded-md transition-colors font-medium">حفظ</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.imageUrl && (
                              <div className="relative rounded-xl overflow-hidden mb-2 group/image mt-1">
                                <img src={msg.imageUrl} alt="Sent" className="max-w-[240px] max-h-[300px] object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300" onClick={() => window.open(msg.imageUrl)} />
                              </div>
                            )}
                            {isAI ? (
                              <AIMessageContent text={msg.text} />
                            ) : (
                              <div className={cn(msg.deleted && "italic text-white/40", "m-0")}>
                                {msg.text?.includes('<span') || msg.text?.includes('style=') ? (
                                  <div className="markdown-body text-current leading-relaxed">
                                    <Markdown rehypePlugins={[rehypeRaw]}>{cleanMessageText(msg.text)}</Markdown>
                                  </div>
                                ) : (
                                  msg.text
                                )}
                              </div>
                            )}
                            {msg.edited && !msg.deleted && <span className="text-[10px] text-white/40 block mt-1.5 opacity-70">(معدلة)</span>}
                          </>
                        )}
                        
                        {!msg.deleted && !isAI && (
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-center gap-1.5 z-10",
                            isMe ? "-left-12" : "-right-12"
                          )}>
                            {isMe && (
                              <button onClick={() => { setEditingMessageId(msg.id); setEditText(msg.text); }} className="w-8 h-8 flex items-center justify-center bg-[#18181b] border border-white/10 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors shadow-lg shadow-black/20 transform hover:scale-110" title="تعديل"><Edit2 size={13} /></button>
                            )}
                            <button onClick={() => handleDeleteMessage(msg)} className="w-8 h-8 flex items-center justify-center bg-[#18181b] border border-white/10 rounded-full text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shadow-lg shadow-black/20 transform hover:scale-110" title="حذف الرسالة"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                      
                      {isMe && (
                        <div className="text-[11px] flex items-center gap-1.5 pr-1 mt-0.5">
                          {msg.read ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shadow-sm animate-in fade-in duration-300">
                              <Eye size={12} className="text-emerald-400" />
                              <span>Vu</span>
                              <span className="text-xs">👀</span>
                            </span>
                          ) : (
                            <span className="text-white/40 font-medium flex items-center gap-1 text-[10px]">
                              <CheckCircle2 size={12} className="text-white/30" />
                              <span>أُرسل</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )})}
                {isOtherTyping && (
                  <div className="flex items-center gap-2.5 my-3 px-4 py-2 bg-[#18181b] border border-emerald-500/30 rounded-2xl w-fit text-xs text-emerald-400 font-bold shadow-lg shadow-emerald-500/10 animate-in fade-in zoom-in-95 duration-200">
                    <Eye size={14} className="text-emerald-400 animate-pulse" />
                    <span>الطرف الآخر يكتب الآن...</span>
                    <div className="inline-flex items-center gap-1 mr-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies always accessible */}
              <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-t border-white/5 bg-[#0a0a0a]/50 min-w-0 w-full shrink-0">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(undefined, reply)}
                    className="shrink-0 px-3 py-1.5 bg-white/5 hover:bg-brand-green/10 hover:text-brand-green border border-white/10 rounded-full text-xs font-bold transition-all whitespace-nowrap"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className={`p-4 md:p-6 border-t border-white/10 flex gap-2 md:gap-4 bg-[#0a0a0a]/90 backdrop-blur-xl shrink-0 ${isWidget ? '' : 'pb-24 md:pb-6'}`}>
                <div className="flex items-center">
                  <label className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl cursor-pointer transition-all text-white/40 hover:text-white">
                    {uploading ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
                <div className="flex-1 relative min-w-0">
                  <input
                    type="text"
                    placeholder="اكتب رسالتك..."
                    value={newMessage}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl py-2 md:py-3 px-4 md:px-6 text-base outline-none focus:border-brand-green/50 focus:bg-white/10 transition-all"
                    dir="auto"
                  />
                </div>
                <button type="submit" disabled={!newMessage.trim() && !uploading} className="shrink-0 min-w-[40px] w-10 h-10 md:min-w-[48px] md:w-12 md:h-12 flex items-center justify-center bg-brand-green text-white rounded-xl md:rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50 disabled:pointer-events-none">
                  <Send size={18} className="rtl:-scale-x-100" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-white/20">
              <MessageSquare size={64} />
              <p className="font-bold">اختر محادثة للبدء</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Single Message Modal */}
      {msgToDelete && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-5 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <Trash2 size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-lg text-white">تأكيد حذف الرسالة</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذه الرسالة نهائياً؟ سيتم حذفها من عند البائع والمشتري معاً.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setMsgToDelete(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmDeleteMessage}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-red-600/30"
              >
                حذف الرسالة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Full Chat Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-5 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-lg text-white">تأكيد حذف المحادثة بالكامل</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                هل أنت متأكد من حذف هذه المحادثة بالكامل وكافة الرسائل التي بداخلها؟ سيتم حذفها نهائياً للبائع والمشتري.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmDeleteChat}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-red-600/30"
              >
                مسح المحادثة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

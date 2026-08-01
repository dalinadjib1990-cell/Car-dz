import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CarFront, X, Bot, Send, Loader2, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import Messages from '../pages/Messages';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { toast } from 'sonner';

function cleanMessageText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/style=["']color:\s*>\s*/gi, 'style="color: ')
    .replace(/color:\s*>\s*#/gi, 'color: #')
    .replace(/color:\s*>/gi, 'color:')
    .replace(/<span style="color:>\s*/gi, '<span style="color: ');
}

interface AIMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export default function FloatingChatBubble() {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'ai'>('messages');
  const [targetChatId, setTargetChatId] = useState<string | null>(null);

  // AI Chat state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `مرحباً بك! أنا **الخبير الآلي لسوق السيارات في الجزائر** 🇩🇿🤖
يمكنك سؤالي عن أسعار السيارات المستعملة، أسعار المحركات في الكاس (**la casse**)، تكاليف الصيانة، أو المقارنة بين السيارات في السوق الجزائري (واد كنيس، مجموعات فيسبوك).`,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.chatId) {
        setTargetChatId(e.detail.chatId);
        setActiveTab('messages');
      } else if (e.detail?.tab === 'ai') {
        setActiveTab('ai');
      }
    };
    window.addEventListener('open-chat-bubble', handleOpen);
    return () => window.removeEventListener('open-chat-bubble', handleOpen);
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, activeTab]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.unreadCount && data.unreadCount[user.uid]) {
          total += data.unreadCount[user.uid];
        }
      });
      setUnreadCount(total);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error("FloatingChatBubble listener error:", error);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleSendAIMessage = async (textToSend?: string) => {
    const queryText = (textToSend || aiInput).trim();
    if (!queryText || aiLoading) return;

    const userMsg: AIMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: queryText,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages(prev => [...prev, userMsg]);
    if (!textToSend) setAiInput('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/gemini/expert-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          history: aiMessages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          }))
        })
      });

      if (!response.ok) {
        throw new Error('فشل الاتصال بالخبير');
      }

      const data = await response.json();
      const botMsg: AIMessage = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: data.reply || 'عذراً، لم أستطع تحليل الطلب الآن.',
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };

      setAiMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      toast.error('حدث خطأ أثناء التواصل مع الخبير الآلي');
    } finally {
      setAiLoading(false);
    }
  };

  const quickPrompts = [
    'كم سعر محرك ياريس 1.3 في الكاس؟',
    'ما رأيك في كليو 3 بـ 140 مليون سنتيم؟',
    'تحليل أسعار غولف 7 في واد كنيس وشريط فيسبوك',
    'ما هي أفضل سيارة بميزانية 120 مليون سنتيم؟'
  ];

  if (!user || location.pathname === '/messages') return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[100] sm:inset-auto sm:bottom-[100px] sm:right-6 overflow-hidden sm:rounded-2xl border-0 sm:border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col w-full h-[100dvh] sm:w-[90vw] sm:max-w-[800px] sm:h-[80vh] sm:max-h-[800px] pointer-events-auto overscroll-none"
          >
            {/* Top Navigation Bar with Tabs */}
            <div className="bg-gradient-to-r from-[#0d0d12] via-[#141420] to-[#0d0d12] border-b border-white/10 p-3 pt-4 flex justify-between items-center z-10 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('messages')}
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                    activeTab === 'messages'
                      ? "bg-brand-green/20 text-brand-green border border-brand-green/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  <CarFront size={18} />
                  <span>الرسائل</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('ai')}
                  className={cn(
                    "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all relative overflow-hidden",
                    activeTab === 'ai'
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/50"
                      : "text-indigo-300 hover:bg-indigo-950/40 border border-indigo-500/20"
                  )}
                >
                  <Bot size={18} className="animate-pulse text-indigo-200" />
                  <span>الخبير الآلي 🤖</span>
                  <Sparkles size={12} className="text-yellow-300 animate-spin" />
                </button>
              </div>

              <button 
                onClick={() => setIsOpen(false)} 
                className="text-white/50 hover:text-white bg-black/40 hover:bg-black/60 p-2 rounded-full transition-colors backdrop-blur-md"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 w-full relative min-h-0 bg-brand-black flex flex-col">
              {activeTab === 'messages' ? (
                <div className="absolute inset-0 sm:rounded-b-2xl overflow-hidden flex flex-col">
                  <Messages isWidget={true} initialChatId={targetChatId} />
                </div>
              ) : (
                /* AI Expert Chat View */
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-b from-[#0b0c10] via-[#0f1018] to-[#0a0a0d]">
                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                    {aiMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3 max-w-[88%]",
                          msg.sender === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                            msg.sender === 'user'
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : "bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                          )}
                        >
                          {msg.sender === 'user' ? <CarFront size={16} /> : <Bot size={16} />}
                        </div>
                        <div
                          className={cn(
                            "p-3.5 rounded-2xl text-sm leading-relaxed",
                            msg.sender === 'user'
                              ? "bg-emerald-600 text-white rounded-tl-none font-medium shadow-md"
                              : "bg-white/5 border border-indigo-500/30 text-white/90 rounded-tr-none shadow-xl"
                          )}
                        >
                          {msg.sender === 'bot' ? (
                            <div className="markdown-body text-white/95 leading-relaxed text-xs md:text-sm">
                              <Markdown rehypePlugins={[rehypeRaw]}>{cleanMessageText(msg.text)}</Markdown>
                            </div>
                          ) : (
                            <p>{msg.text}</p>
                          )}
                          <span className="text-[10px] text-white/30 block text-left mt-1">{msg.time}</span>
                        </div>
                      </div>
                    ))}

                    {aiLoading && (
                      <div className="flex gap-3 max-w-[80%] ml-auto">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white border border-indigo-400 shadow-lg animate-pulse">
                          <Bot size={16} />
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-indigo-500/30 text-indigo-300 rounded-tr-none flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-indigo-400" />
                          <span className="text-xs font-bold">الخبير الآلي يبحث ويحلل بيانات السوق الجزائري...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick Suggestions Chips */}
                  <div className="px-4 py-2 border-t border-white/5 bg-black/40 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                    {quickPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendAIMessage(prompt)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600 hover:text-white transition-all whitespace-nowrap shrink-0"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Input Box */}
                  <div className="p-3 border-t border-white/10 bg-[#0d0d12] shrink-0">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendAIMessage();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="اسأل الخبير الآلي عن أي سيارة، سعر محرك، أو استشارة..."
                        className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!aiInput.trim() || aiLoading}
                        className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-indigo-600/30"
                      >
                        {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-20 right-4 md:right-6 z-[90] pointer-events-auto overscroll-none">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all duration-300 shadow-2xl",
            isOpen 
              ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30" 
              : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 border-indigo-300 text-white shadow-[0_0_25px_rgba(79,70,229,0.5)]"
          )}
        >
          {isOpen ? (
            <X className="w-6 h-6 md:w-8 md:h-8" />
          ) : (
            <Bot className="w-7 h-7 md:w-8 md:h-8 animate-pulse text-white" />
          )}
        </motion.button>
        
        {!isOpen && unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] md:text-xs font-bold w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center border-2 border-[#0a0a0a] shadow-lg"
          >
            {unreadCount > 9 ? '+9' : unreadCount}
          </motion.div>
        )}
      </div>
    </>
  );
}

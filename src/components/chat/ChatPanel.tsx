import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings, X, Cpu, ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { AI_MODELS, PROVIDER_LABELS, getStoredKeys, saveKeys, AIModel } from '@/lib/aiModels';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  provider?: string;
  context?: string[];
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#cc785c',
  openai: '#10a37f',
  google: '#4285f4',
};

export default function ChatPanel() {
  const { activeFile, activeProject, tasks, selectedModel, setSelectedModel, currentUserId, loginState } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'AI Cortex online. I have full context of your active project, open file, and tasks. Switch models freely — I carry the conversation across providers.', model: selectedModel }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [keys, setKeys] = useState(getStoredKeys());
  const [keySaved, setKeySaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const activeTask = tasks.find(t => t.status === 'IN_PROGRESS' && t.assignee_id === currentUserId) || null;
  const selectedModelObj = AI_MODELS.find(m => m.id === selectedModel);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    const model = AI_MODELS.find(m => m.id === selectedModel);
    const contexts: string[] = [];
    if (activeFile) contexts.push(`📄 ${activeFile.file_name}`);
    if (activeTask) contexts.push(`🎯 ${activeTask.title}`);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, context: contexts };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const streamId = `stream-${Date.now()}`;
    streamingIdRef.current = streamId;

    // Seed the streaming placeholder immediately so the user sees the model name
    setMessages(prev => [...prev, {
      id: streamId,
      role: 'assistant',
      content: '',
      model: selectedModel,
      provider: model?.provider,
    }]);

    try {
      const stored = getStoredKeys();
      const apiUrl = stored.baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:8000';

      const payload = {
        user_message: text,
        model_id: selectedModel,
        provider: model?.provider || 'google',
        active_file_content: activeFile?.content || null,
        active_task: activeTask ? `${activeTask.title}: ${activeTask.description || ''}` : null,
        project_id: activeProject?.id || null,
        api_keys: {
          anthropic: stored.anthropic || null,
          openai: stored.openai || null,
          google: stored.google || null,
        },
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const { data: session } = await import('@/lib/supabaseClient').then(m => m.supabase.auth.getSession());
      if (session?.session?.access_token) headers['Authorization'] = `Bearer ${session.session.access_token}`;

      const response = await fetch(`${apiUrl}/api/ai/chat/stream`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `API error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.token) {
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: m.content + event.token } : m
              ));
            } else if (event.meta) {
              const ragContext = event.meta.rag_used
                ? ['RAG active', ...(event.meta.rag_files || [])]
                : undefined;
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, context: ragContext } : m
              ));
            } else if (event.error) {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err: any) {
      // Replace the streaming placeholder with the error
      setMessages(prev => prev.map(m =>
        m.id === streamId
          ? { ...m, content: `> Connection error: ${err.message || 'Backend unreachable'}. Ensure FastAPI is running and your API key is set in Settings.` }
          : m
      ));
    } finally {
      streamingIdRef.current = null;
      setIsTyping(false);
    }
  };

  const saveSettings = () => {
    saveKeys(keys);
    setKeySaved(true);
    setTimeout(() => { setKeySaved(false); setSettingsOpen(false); }, 1200);
  };

  const modelsByProvider = AI_MODELS.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, AIModel[]>);

  return (
    <div className="flex flex-col h-full relative" style={{ background: '#080808' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: '#030303' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
            <div className="w-1.5 h-1.5 rounded-full amber-pulse" style={{ background: '#f59e0b' }} />
          </div>
          <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f7f3ee' }}>AI Cortex</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative">
            <button onClick={() => setModelDropOpen(p => !p)}
              className="flex items-center gap-2 px-2.5 py-1.5 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, fontSize: 10, fontFamily: '"DM Sans", sans-serif', fontWeight: 500, color: '#a09590' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.3)'; (e.currentTarget as HTMLElement).style.color = '#f7f3ee'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#a09590'; }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[selectedModelObj?.provider || 'google'] }} />
              <span className="max-w-[100px] truncate">{selectedModelObj?.displayName || selectedModel}</span>
              <ChevronDown size={10} style={{ opacity: 0.5 }} />
            </button>

            <AnimatePresence>
              {modelDropOpen && (
                <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-1.5 w-[240px] z-50 glass"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.4)' }}>
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-3 py-2" style={{ fontSize: 10, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3a3836', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {PROVIDER_LABELS[provider]}
                      </div>
                      {models.map(m => (
                        <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelDropOpen(false); }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all"
                          style={{ background: selectedModel === m.id ? 'rgba(245,158,11,0.09)' : 'transparent' }}
                          onMouseEnter={e => { if (selectedModel !== m.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={e => { if (selectedModel !== m.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PROVIDER_COLORS[provider] }} />
                          <div className="min-w-0 flex-1">
                            <div style={{ fontSize: 12, fontWeight: 500, color: selectedModel === m.id ? '#f7f3ee' : '#a09590', fontFamily: '"DM Sans", sans-serif' }}>{m.displayName}</div>
                            <div style={{ fontSize: 10, color: '#3a3836', marginTop: 2, fontFamily: '"DM Sans", sans-serif' }}>{m.description}</div>
                          </div>
                          {selectedModel === m.id && <CheckCircle size={11} className="ml-auto shrink-0 mt-1" style={{ color: '#f59e0b', opacity: 0.7 }} />}
                        </button>
                      ))}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            className="w-8 h-8 flex items-center justify-center transition-all rounded"
            style={{ color: '#5e5855' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f59e0b'; (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5e5855'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Context badges */}
      {(activeFile || activeTask) && (
        <div className="flex gap-2 px-4 py-2.5 flex-wrap shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'rgba(245,158,11,0.015)' }}>
          {activeFile && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', border: '1px solid rgba(255,255,255,0.08)', color: '#a09590', padding: '3px 8px', borderRadius: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: 1, background: '#a09590', display: 'inline-block', opacity: 0.6 }} />
              {activeFile.file_name}
            </span>
          )}
          {activeTask && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', border: '1px solid rgba(79,142,247,0.2)', color: '#4f8ef7', padding: '3px 8px', borderRadius: 2, background: 'rgba(79,142,247,0.05)' }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: '#4f8ef7', display: 'inline-block' }} />
              {activeTask.title}
            </span>
          )}
        </div>
      )}

      {/* Settings overlay */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 p-6 flex flex-col" style={{ background: '#080808', borderLeft: '1px solid var(--border-1)' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 14, color: '#f7f3ee', letterSpacing: '-0.01em' }}>Configuration</div>
                <div style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', color: '#3a3836', marginTop: 3 }}>Keys stored locally · never sent to server</div>
              </div>
              <button onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 flex items-center justify-center transition-all rounded"
                style={{ color: '#5e5855', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f7f3ee'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#5e5855'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
              {[
                { label: 'Anthropic API Key', key: 'anthropic' as const, placeholder: 'sk-ant-...' },
                { label: 'OpenAI API Key', key: 'openai' as const, placeholder: 'sk-...' },
                { label: 'Google Gemini Key', key: 'google' as const, placeholder: 'AIza...' },
                { label: 'Backend URL', key: 'baseUrl' as const, placeholder: 'https://your-backend.railway.app' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="form-label">{label}</label>
                  <input type={key === 'baseUrl' ? 'text' : 'password'} placeholder={placeholder}
                    value={keys[key]} onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                    className="input-contained" style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }} />
                </div>
              ))}
            </div>
            <button onClick={saveSettings}
              className="mt-5 w-full h-10 flex items-center justify-center gap-2 transition-all"
              style={{
                border: '1px solid #f59e0b',
                borderRadius: 2,
                color: keySaved ? '#000' : '#f59e0b',
                background: keySaved ? '#f59e0b' : 'transparent',
                fontSize: 11,
                fontFamily: '"Syne", sans-serif',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                boxShadow: keySaved ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
              }}>
              {keySaved ? <><CheckCircle size={12} /> Saved</> : 'Save Configuration'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex flex-col gap-1.5 max-w-[94%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            {msg.role === 'assistant' && msg.model && (
              <div className="flex items-center gap-1.5" style={{ paddingLeft: 2 }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[msg.provider || 'google'] }} />
                <span style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', fontWeight: 500, color: '#3a3836' }}>
                  {AI_MODELS.find(m => m.id === msg.model)?.displayName || msg.model}
                </span>
              </div>
            )}
            <div className={cn("leading-relaxed", msg.role === 'user' ? "px-4 py-3" : "px-1")}
              style={msg.role === 'user'
                ? {
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.18)',
                    borderTop: '2px solid rgba(245,158,11,0.55)',
                    borderRadius: 3,
                    fontSize: 13,
                    fontFamily: '"DM Sans", sans-serif',
                    fontWeight: 500,
                    color: '#f7f3ee',
                    lineHeight: 1.6,
                  }
                : { fontSize: 13, color: '#a09590', fontFamily: '"DM Sans", sans-serif', lineHeight: 1.65 }}>
              {msg.role === 'assistant'
                ? <div className="markdown-body prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : <span>{msg.content}</span>}
            </div>
            {msg.context && msg.context.length > 0 && (
              <div className="flex gap-1 flex-wrap" style={{ paddingLeft: msg.role === 'assistant' ? 2 : 0 }}>
                {msg.context.map((c, i) => (
                  <span key={i} style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', border: '1px solid rgba(255,255,255,0.06)', color: '#3a3836', padding: '1px 6px', borderRadius: 2 }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5 items-center" style={{ paddingLeft: 2 }}>
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f59e0b', opacity: 0.4, animationDelay: `${i * 0.12}s` }} />)}
            </div>
            <span style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', color: '#3a3836' }}>Thinking…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0" style={{ padding: '12px 14px', borderTop: '1px solid var(--border-1)', background: '#030303' }}>
        <div className="flex flex-col gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask anything…"
            className="w-full outline-none resize-none custom-scrollbar input-contained"
            style={{ minHeight: 68, fontSize: 13, borderRadius: 3 }} />
          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: 10, fontFamily: '"DM Sans", sans-serif', color: '#3a3836' }}>Shift+↵ newline</span>
            <button onClick={handleSend} disabled={isTyping || !input.trim()}
              className="flex items-center gap-2 px-4 h-9 transition-all"
              style={{
                background: input.trim() && !isTyping ? '#f59e0b' : 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 2,
                color: input.trim() && !isTyping ? '#000' : 'rgba(245,158,11,0.3)',
                fontSize: 11,
                fontFamily: '"Syne", sans-serif',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                boxShadow: input.trim() && !isTyping ? '0 2px 8px rgba(245,158,11,0.2)' : 'none',
              }}>
              <Send size={11} /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

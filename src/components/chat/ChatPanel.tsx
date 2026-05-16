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
          <span style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f7f3ee' }}>AI Cortex</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative">
            <button onClick={() => setModelDropOpen(p => !p)}
              className="flex items-center gap-1.5 px-2 py-1 transition-all"
              style={{ border: '1px solid var(--border-1)', fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a09590' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-1)')}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[selectedModelObj?.provider || 'google'] }} />
              <span className="max-w-[90px] truncate">{selectedModelObj?.displayName || selectedModel}</span>
              <ChevronDown size={9} />
            </button>

            <AnimatePresence>
              {modelDropOpen && (
                <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-1 w-[220px] z-50"
                  style={{ background: '#0a0a0a', border: '1px solid rgba(245,158,11,0.15)', boxShadow: '0 16px 32px rgba(0,0,0,0.8)' }}>
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-3 py-1.5 border-b" style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3a3836', borderColor: 'var(--border-1)' }}>
                        {PROVIDER_LABELS[provider]}
                      </div>
                      {models.map(m => (
                        <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelDropOpen(false); }}
                          className="w-full flex items-start gap-2 px-3 py-2 text-left transition-all"
                          style={{ background: selectedModel === m.id ? 'rgba(245,158,11,0.06)' : 'transparent', borderLeft: selectedModel === m.id ? '2px solid #f59e0b' : '2px solid transparent' }}>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PROVIDER_COLORS[provider] }} />
                          <div className="min-w-0">
                            <div style={{ fontSize: 10, fontWeight: 500, color: selectedModel === m.id ? '#f7f3ee' : '#a09590' }}>{m.displayName}</div>
                            <div style={{ fontSize: 8, color: '#3a3836', marginTop: 1 }}>{m.description}</div>
                          </div>
                          {selectedModel === m.id && <CheckCircle size={10} className="ml-auto shrink-0 mt-1" style={{ color: '#f59e0b', opacity: 0.7 }} />}
                        </button>
                      ))}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setSettingsOpen(true)} className="p-1.5 transition-colors" style={{ color: '#3a3836' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3836')}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Context badges */}
      {(activeFile || activeTask) && (
        <div className="flex gap-1.5 px-4 py-2 flex-wrap shrink-0" style={{ borderBottom: '1px solid var(--border-1)', background: 'rgba(245,158,11,0.02)' }}>
          {activeFile && <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', border: '1px solid var(--border-2)', color: '#5e5855', padding: '2px 6px' }}>📄 {activeFile.file_name}</span>}
          {activeTask && <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', border: '1px solid rgba(79,142,247,0.25)', color: '#4f8ef7', padding: '2px 6px' }}>🎯 {activeTask.title}</span>}
        </div>
      )}

      {/* Settings overlay */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 p-8 flex flex-col" style={{ background: '#080808', borderLeft: '1px solid var(--border-1)' }}>
            <div className="flex items-center justify-between mb-8">
              <h2 style={{ fontFamily: '"Syne", sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f7f3ee' }}>API Keys & Config</h2>
              <button onClick={() => setSettingsOpen(false)} style={{ opacity: 0.3, color: '#f7f3ee' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-6 flex-1">
              <div style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3a3836', marginBottom: 16 }}>Keys stored in localStorage — never sent to our server</div>

              {[
                { label: 'Anthropic API Key', key: 'anthropic' as const, placeholder: 'sk-ant-...' },
                { label: 'OpenAI API Key', key: 'openai' as const, placeholder: 'sk-...' },
                { label: 'Google (Gemini) API Key', key: 'google' as const, placeholder: 'AIza...' },
                { label: 'Backend URL (optional)', key: 'baseUrl' as const, placeholder: 'https://your-backend.railway.app' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 8, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5e5855', display: 'block', marginBottom: 8 }}>{label}</label>
                  <input type={key === 'baseUrl' ? 'text' : 'password'} placeholder={placeholder}
                    value={keys[key]} onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-transparent py-2 outline-none transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#f7f3ee' }} />
                </div>
              ))}
            </div>
            <button onClick={saveSettings}
              className="mt-6 w-full h-11 flex items-center justify-center gap-2 transition-all"
              style={{ border: '1px solid #f59e0b', color: keySaved ? '#000' : '#f59e0b', background: keySaved ? '#f59e0b' : 'transparent', fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              {keySaved ? <><CheckCircle size={13} /> Saved</> : 'Save Configuration'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex flex-col gap-2 max-w-[92%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            {msg.role === 'assistant' && msg.model && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[msg.provider || 'google'] }} />
                <span style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a3836' }}>
                  {AI_MODELS.find(m => m.id === msg.model)?.displayName || msg.model}
                </span>
              </div>
            )}
            <div className={cn("leading-relaxed", msg.role === 'user' ? "px-4 py-2" : "")}
              style={msg.role === 'user'
                ? { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderTop: '2px solid #f59e0b', fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 500, color: '#f7f3ee' }
                : { fontSize: 12, color: '#a09590', fontFamily: '"DM Sans", sans-serif' }}>
              {msg.role === 'assistant'
                ? <div className="markdown-body prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : <span>{msg.content}</span>}
            </div>
            {msg.context && msg.context.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {msg.context.map((c, i) => (
                  <span key={i} style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', border: '1px solid var(--border-1)', color: '#3a3836', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#f59e0b', opacity: 0.5, animationDelay: `${i * 0.15}s` }} />)}
            </div>
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3a3836' }}>Processing…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-1)', background: '#030303' }}>
        <div className="flex flex-col gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask anything… (Shift+Enter for newline)"
            className="w-full outline-none resize-none custom-scrollbar transition-all"
            style={{ background: '#080808', border: '1px solid var(--border-1)', padding: '10px 12px', fontSize: 11, fontFamily: '"DM Sans", sans-serif', color: '#f7f3ee', minHeight: 72 }} />
          <button onClick={handleSend} disabled={isTyping || !input.trim()}
            className="w-full h-9 flex items-center justify-center gap-2 transition-all"
            style={{ background: input.trim() && !isTyping ? '#f59e0b' : 'transparent', border: '1px solid rgba(245,158,11,0.3)', color: input.trim() && !isTyping ? '#000' : 'rgba(245,158,11,0.3)', fontSize: 9, fontFamily: '"Syne", sans-serif', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            <Send size={11} /> Send
          </button>
        </div>
      </div>
    </div>
  );
}

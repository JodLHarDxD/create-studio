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
    <div className="flex flex-col h-full bg-black relative">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">AI Cortex</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector — free-will switching like Claude.ai */}
          <div className="relative">
            <button onClick={() => setModelDropOpen(p => !p)}
              className="flex items-center gap-2 border border-white/10 px-2 py-1.5 text-[8px] font-black uppercase tracking-wider hover:bg-white/5 transition-all">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[selectedModelObj?.provider || 'google'] }} />
              <span className="max-w-[100px] truncate">{selectedModelObj?.displayName || selectedModel}</span>
              <ChevronDown size={10} />
            </button>

            <AnimatePresence>
              {modelDropOpen && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="absolute right-0 top-full mt-1 w-[220px] bg-[#111] border border-white/10 z-50 shadow-2xl">
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest opacity-30 border-b border-white/5">
                        {PROVIDER_LABELS[provider]}
                      </div>
                      {models.map(m => (
                        <button key={m.id} onClick={() => { setSelectedModel(m.id); setModelDropOpen(false); }}
                          className={cn("w-full flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-all text-left", selectedModel === m.id && 'bg-white/10')}>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: PROVIDER_COLORS[provider] }} />
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold">{m.displayName}</div>
                            <div className="text-[8px] opacity-40">{m.description}</div>
                          </div>
                          {selectedModel === m.id && <CheckCircle size={10} className="ml-auto shrink-0 mt-1 opacity-60" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setSettingsOpen(true)} className="p-1.5 text-white/30 hover:text-white transition-colors">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Context badges */}
      {(activeFile || activeTask) && (
        <div className="flex gap-2 px-4 py-2 bg-white/3 border-b border-white/5 flex-wrap shrink-0">
          {activeFile && <span className="text-[8px] border border-white/15 px-2 py-0.5 font-mono opacity-60">📄 {activeFile.file_name}</span>}
          {activeTask && <span className="text-[8px] border border-blue-500/30 text-blue-400 px-2 py-0.5 font-mono opacity-80">🎯 {activeTask.title}</span>}
        </div>
      )}

      {/* Settings overlay */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0a0a0a] p-8 flex flex-col border-l border-white/10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em]">API Keys & Config</h2>
              <button onClick={() => setSettingsOpen(false)}><X size={18} className="opacity-40 hover:opacity-100" /></button>
            </div>
            <div className="space-y-6 flex-1">
              <div className="text-[8px] uppercase tracking-widest opacity-40 mb-4">Keys stored in localStorage — never sent to our server</div>

              {[
                { label: 'Anthropic API Key', key: 'anthropic' as const, placeholder: 'sk-ant-...' },
                { label: 'OpenAI API Key', key: 'openai' as const, placeholder: 'sk-...' },
                { label: 'Google (Gemini) API Key', key: 'google' as const, placeholder: 'AIza...' },
                { label: 'Backend URL (optional)', key: 'baseUrl' as const, placeholder: 'https://your-backend.railway.app' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="relative">
                  <label className="text-[8px] font-black tracking-widest uppercase opacity-40 block mb-2">{label}</label>
                  <input type={key === 'baseUrl' ? 'text' : 'password'} placeholder={placeholder}
                    value={keys[key]} onChange={e => setKeys(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-transparent border-b border-white/20 py-2 text-xs font-mono focus:border-white focus:outline-none transition-colors" />
                </div>
              ))}
            </div>
            <button onClick={saveSettings}
              className="mt-6 w-full h-12 border border-white flex items-center justify-center text-[9px] font-black uppercase tracking-[0.4em] hover:bg-white hover:text-black transition-all gap-2">
              {keySaved ? <><CheckCircle size={14} /> Saved</> : 'Save Configuration'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex flex-col gap-2 max-w-[92%]", msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
            {msg.role === 'assistant' && msg.model && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[msg.provider || 'google'] }} />
                <span className="text-[7px] font-black uppercase tracking-widest opacity-30">
                  {AI_MODELS.find(m => m.id === msg.model)?.displayName || msg.model}
                </span>
              </div>
            )}
            <div className={cn("text-[12px] leading-relaxed",
              msg.role === 'user' ? "bg-white text-black px-4 py-2 font-bold" : "text-[#d4d4d4] font-medium")}>
              {msg.role === 'assistant'
                ? <div className="markdown-body prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : <span>{msg.content}</span>}
            </div>
            {msg.context && msg.context.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {msg.context.map((c, i) => (
                  <span key={i} className="text-[7px] border border-white/10 px-1.5 py-0.5 uppercase font-black opacity-30">{c}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2 items-center px-1 text-[9px] font-black uppercase tracking-widest opacity-20">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
            <span>Processing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-black shrink-0">
        <div className="flex flex-col gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask anything... (Shift+Enter for newline)"
            className="w-full bg-[#111] border border-white/10 focus:border-white/30 p-3 text-[11px] font-mono focus:outline-none resize-none min-h-[80px] transition-all placeholder:opacity-30" />
          <button onClick={handleSend} disabled={isTyping || !input.trim()}
            className="w-full h-10 bg-white text-black text-[9px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-2 hover:bg-white/90 transition-all disabled:opacity-20">
            <Send size={12} /> Send Packet
          </button>
        </div>
      </div>
    </div>
  );
}

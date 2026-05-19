import { useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Github, Zap, Crown } from 'lucide-react';

export default function TeamPage() {
  const { users, tasks, currentUserId } = useWorkspace();

  const members = useMemo(() => {
    return users
      .map(user => {
        const assigned = tasks.filter(t => t.assignee_id === user.id);
        const done     = assigned.filter(t => t.status === 'DONE').length;
        const active   = assigned.filter(t => t.status === 'IN_PROGRESS').length;
        const todo     = assigned.filter(t => t.status === 'TODO').length;
        const rate     = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;
        const score    = done * 10 + active * 4 + rate;
        return { ...user, assigned: assigned.length, done, active, todo, rate, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [users, tasks]);

  const totalDone   = tasks.filter(t => t.status === 'DONE').length;
  const totalActive = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const admins      = users.filter(u => u.role === 'ADMIN').length;

  return (
    <div className="flex-1 overflow-auto custom-scrollbar bg-zinc-950/40 text-zinc-200">

      {/* ── Header ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 grid-overlay" />

        <div className="relative px-12 py-12 flex items-end justify-between gap-8">
          <div>
            <div className="font-mono text-[10px] tracking-[0.30em] uppercase text-emerald-400 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Internal Directory
            </div>
            <h1
              className="font-display italic text-zinc-100"
              style={{ fontSize: 64, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 0.95 }}
            >
              The Team.
            </h1>
            <div className="mt-4 text-[11px] font-mono text-zinc-500 tracking-[0.10em]">
              {members.length} operative{members.length !== 1 ? 's' : ''} · {admins} admin{admins !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Global stats */}
          <div className="flex shrink-0 border border-white/[0.06]">
            {[
              { label: 'Total Tasks', value: tasks.length },
              { label: 'Delivered',  value: totalDone, accent: true },
              { label: 'In Flight',  value: totalActive },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                className="px-6 py-4 flex flex-col gap-1 bg-zinc-900/50 backdrop-blur-md border-r border-white/[0.06] last:border-r-0"
              >
                <div className="font-mono text-[9px] tracking-[0.30em] uppercase text-zinc-500">{label}</div>
                <div
                  className="font-display italic"
                  style={{
                    fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em',
                    color: accent ? '#34d399' : '#f4f4f5',
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="px-12 py-3 flex items-center gap-4 border-b border-white/[0.04] bg-zinc-950/60">
        <div style={{ width: 32, flexShrink: 0 }} />
        <div className="flex-1 font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Operative</div>
        <div className="hidden md:block w-[72px] text-center font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Done</div>
        <div className="hidden md:block w-[72px] text-center font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Active</div>
        <div className="hidden lg:block w-[72px] text-center font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Assigned</div>
        <div className="w-[120px] font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Completion</div>
        <div className="w-[60px] text-right font-mono text-[9px] tracking-[0.25em] uppercase text-zinc-500">Score</div>
      </div>

      {/* Member rows */}
      <div>
        {members.map((member, idx) => {
          const isMe = member.id === currentUserId;
          const isOnline = member.active > 0;
          const isAdmin = member.role === 'ADMIN';

          return (
            <div
              key={member.id}
              className="px-12 py-5 flex items-center gap-4 group transition-colors duration-200 border-b border-white/[0.04] hover:bg-white/[0.02]"
              style={{ background: isMe ? 'rgba(52,211,153,0.025)' : 'transparent' }}
            >
              {/* Rank */}
              <div style={{ width: 32, flexShrink: 0 }} className="text-center">
                {idx === 0 ? (
                  <Crown size={15} className="text-emerald-400 mx-auto" strokeWidth={1.5} />
                ) : (
                  <span className="font-mono text-[11px] text-zinc-600 tracking-wide">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Avatar + info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 overflow-hidden flex items-center justify-center bg-emerald-500/[0.08]"
                    style={{ border: isMe ? '2px solid rgba(52,211,153,0.55)' : '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                      : <span className="font-display italic text-emerald-300" style={{ fontSize: 18 }}>
                          {member.full_name[0]?.toUpperCase()}
                        </span>
                    }
                  </div>
                  <div
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950"
                    style={{ background: isOnline ? '#34d399' : '#52525b', boxShadow: isOnline ? '0 0 6px rgba(52,211,153,0.6)' : 'none' }}
                    title={isOnline ? 'Active' : 'Idle'}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display italic text-zinc-100" style={{ fontSize: 17, fontWeight: 400, letterSpacing: '-0.01em' }}>
                      {member.full_name}
                    </span>
                    {isMe && (
                      <span className="text-[8px] font-mono tracking-[0.25em] uppercase text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5">
                        you
                      </span>
                    )}
                    <span
                      className="text-[8px] font-mono tracking-[0.25em] uppercase px-2 py-0.5 border"
                      style={{
                        color: isAdmin ? '#34d399' : '#71717a',
                        borderColor: isAdmin ? 'rgba(52,211,153,0.30)' : 'rgba(255,255,255,0.10)',
                        background: isAdmin ? 'rgba(52,211,153,0.04)' : 'transparent',
                      }}
                    >
                      {member.role}
                    </span>
                    {isOnline && (
                      <span className="flex items-center gap-1 text-[8px] font-mono tracking-[0.15em] text-emerald-400">
                        <Zap size={8} strokeWidth={2} /> ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[10px] font-mono text-zinc-500">{member.email}</span>
                    {member.bio && (
                      <span className="text-[10px] text-zinc-500 truncate max-w-[200px] italic">
                        · {member.bio}
                      </span>
                    )}
                    {member.github_url && (
                      <a
                        href={member.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <Github size={10} /> github
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-center shrink-0 w-[72px]">
                <span
                  className="font-display italic"
                  style={{
                    fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em',
                    color: member.done > 0 ? '#34d399' : '#52525b', lineHeight: 1,
                  }}
                >
                  {member.done}
                </span>
                <span className="font-mono text-[8px] text-zinc-600 tracking-[0.20em] uppercase mt-1">Done</span>
              </div>

              <div className="hidden md:flex flex-col items-center shrink-0 w-[72px]">
                <span
                  className="font-display italic"
                  style={{
                    fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em',
                    color: member.active > 0 ? '#8b5cf6' : '#52525b', lineHeight: 1,
                  }}
                >
                  {member.active}
                </span>
                <span className="font-mono text-[8px] text-zinc-600 tracking-[0.20em] uppercase mt-1">In Flight</span>
              </div>

              <div className="hidden lg:flex flex-col items-center shrink-0 w-[72px]">
                <span
                  className="font-display italic text-zinc-500"
                  style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}
                >
                  {member.assigned}
                </span>
                <span className="font-mono text-[8px] text-zinc-600 tracking-[0.20em] uppercase mt-1">Total</span>
              </div>

              <div className="shrink-0 w-[120px]">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: member.rate > 0 ? '#34d399' : '#52525b' }}
                  >
                    {member.rate}%
                  </span>
                </div>
                <div className="w-full h-px bg-white/[0.08]">
                  <div
                    style={{
                      width: `${member.rate}%`,
                      height: '100%',
                      background:
                        member.rate >= 80
                          ? 'linear-gradient(90deg, #34d399, #8b5cf6)'
                          : member.rate >= 40
                            ? '#34d399'
                            : '#52525b',
                      transition: 'width 0.6s ease',
                      boxShadow: member.rate >= 40 ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 text-right w-[60px]">
                <span
                  className="font-display italic"
                  style={{
                    fontWeight: 400, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1,
                    color:
                      idx === 0 ? '#34d399'
                      : idx === 1 ? '#d4d4d8'
                      : idx === 2 ? '#a78bfa'
                      : '#52525b',
                  }}
                >
                  {member.score}
                </span>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="py-24 text-center font-mono text-[11px] tracking-[0.25em] uppercase text-zinc-600">
            No team members yet.
          </div>
        )}
      </div>

      {/* Score legend */}
      <div className="px-12 py-6 flex items-center gap-8 border-t border-white/[0.04] bg-zinc-950/40">
        <span className="font-mono text-[9px] tracking-[0.30em] uppercase text-zinc-500">Score formula</span>
        {[
          { label: 'Task done',     value: '×10' },
          { label: 'In progress',   value: '×4'  },
          { label: 'Completion %',  value: '×1'  },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-emerald-400">{value}</span>
            <span className="text-[10px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Github, Zap, CheckCircle2, Clock, Circle, Crown, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeamPage() {
  const { users, tasks, currentUserId, loginState } = useWorkspace();

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
    <div className="flex-1 overflow-auto custom-scrollbar" style={{ background: '#EFEAE0', color: '#1A1612' }}>

      {/* ── Header ── */}
      <div className="relative overflow-hidden" style={{ borderBottom: '1px solid rgba(26,22,18,0.08)' }}>
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(191,74,42,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(191,74,42,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative px-12 py-10 flex items-end justify-between gap-8">
          <div>
            <div style={{ fontSize: 8, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#BF4A2A', marginBottom: 10 }}>
              Internal Directory
            </div>
            <h1 style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em', lineHeight: 0.9, color: '#1A1612' }}>
              THE TEAM
            </h1>
            <div style={{ marginTop: 14, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1', letterSpacing: '0.08em' }}>
              {members.length} operative{members.length !== 1 ? 's' : ''} · {admins} admin{admins !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Global stats */}
          <div className="flex gap-px shrink-0" style={{ border: '1px solid rgba(26,22,18,0.08)' }}>
            {[
              { label: 'Total Tasks', value: tasks.length },
              { label: 'Delivered', value: totalDone, amber: true },
              { label: 'In Flight', value: totalActive },
            ].map(({ label, value, amber }) => (
              <div key={label} className="px-6 py-4 flex flex-col gap-1" style={{ background: '#EFEAE0', borderRight: '1px solid rgba(26,22,18,0.05)' }}>
                <div style={{ fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>{label}</div>
                <div style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: amber ? '#BF4A2A' : '#1A1612', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="px-12 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(26,22,18,0.05)', background: '#F4EFE6' }}>
        <div style={{ width: 32, flexShrink: 0 }} />
        <div className="flex-1" style={{ fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Operative</div>
        <div className="hidden md:block" style={{ width: 72, textAlign: 'center', fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Done</div>
        <div className="hidden md:block" style={{ width: 72, textAlign: 'center', fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Active</div>
        <div className="hidden lg:block" style={{ width: 72, textAlign: 'center', fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Assigned</div>
        <div style={{ width: 120, fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Completion</div>
        <div style={{ width: 60, textAlign: 'right', fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Score</div>
      </div>

      {/* ── Member rows ── */}
      <div>
        {members.map((member, idx) => {
          const isMe     = member.id === currentUserId;
          const isOnline = member.active > 0;
          const isAdmin  = member.role === 'ADMIN';

          return (
            <div
              key={member.id}
              className="px-12 py-5 flex items-center gap-4 group transition-colors duration-150"
              style={{
                borderBottom: '1px solid rgba(26,22,18,0.04)',
                background: isMe ? 'rgba(191,74,42,0.02)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isMe ? 'rgba(191,74,42,0.04)' : 'rgba(26,22,18,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = isMe ? 'rgba(191,74,42,0.02)' : 'transparent')}
            >
              {/* Rank */}
              <div style={{ width: 32, flexShrink: 0, textAlign: 'center' }}>
                {idx === 0 ? (
                  <Crown size={14} style={{ color: '#BF4A2A', margin: '0 auto' }} />
                ) : (
                  <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Avatar + info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      background: 'rgba(191,74,42,0.08)',
                      border: isMe ? '2px solid rgba(191,74,42,0.5)' : '1px solid rgba(26,22,18,0.08)',
                    }}>
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                      : <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 16, color: '#BF4A2A' }}>
                          {member.full_name[0]?.toUpperCase()}
                        </span>
                    }
                  </div>
                  {/* Online dot */}
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                    style={{
                      background: isOnline ? '#4A6B3A' : '#C4BDB1',
                      border: '2px solid #EFEAE0',
                    }}
                    title={isOnline ? 'Active — has tasks in progress' : 'Idle'}
                  />
                </div>

                {/* Name + meta */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 14, color: '#1A1612', letterSpacing: '-0.01em' }}>
                      {member.full_name}
                    </span>
                    {isMe && (
                      <span style={{ fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#BF4A2A', border: '1px solid rgba(191,74,42,0.3)', padding: '1px 5px' }}>
                        you
                      </span>
                    )}
                    <span style={{
                      fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.2em',
                      textTransform: 'uppercase', padding: '1px 6px',
                      color: isAdmin ? '#BF4A2A' : '#9B948A',
                      border: isAdmin ? '1px solid rgba(191,74,42,0.25)' : '1px solid rgba(26,22,18,0.08)',
                      background: isAdmin ? 'rgba(191,74,42,0.05)' : 'transparent',
                    }}>
                      {member.role}
                    </span>
                    {isOnline && (
                      <span className="flex items-center gap-1" style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', color: '#4A6B3A', letterSpacing: '0.1em' }}>
                        <Zap size={8} /> ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1' }}>
                      {member.email}
                    </span>
                    {member.bio && (
                      <span style={{ fontSize: 9, fontFamily: '"Inter", sans-serif', color: '#9B948A' }} className="truncate max-w-[200px]">
                        · {member.bio}
                      </span>
                    )}
                    {member.github_url && (
                      <a href={member.github_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 transition-colors"
                        style={{ fontSize: 9, color: '#C4BDB1' }}
                        onClick={e => e.stopPropagation()}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1A1612'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#C4BDB1'}>
                        <Github size={10} /> github
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Done */}
              <div className="hidden md:flex flex-col items-center shrink-0" style={{ width: 72 }}>
                <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: member.done > 0 ? '#4A6B3A' : '#C4BDB1', lineHeight: 1 }}>
                  {member.done}
                </span>
                <span style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1', letterSpacing: '0.12em', marginTop: 2 }}>DONE</span>
              </div>

              {/* Active */}
              <div className="hidden md:flex flex-col items-center shrink-0" style={{ width: 72 }}>
                <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: member.active > 0 ? '#60a5fa' : '#C4BDB1', lineHeight: 1 }}>
                  {member.active}
                </span>
                <span style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1', letterSpacing: '0.12em', marginTop: 2 }}>IN FLIGHT</span>
              </div>

              {/* Assigned */}
              <div className="hidden lg:flex flex-col items-center shrink-0" style={{ width: 72 }}>
                <span style={{ fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: '#C4BDB1', lineHeight: 1 }}>
                  {member.assigned}
                </span>
                <span style={{ fontSize: 7, fontFamily: '"JetBrains Mono", monospace', color: '#C4BDB1', letterSpacing: '0.12em', marginTop: 2 }}>TOTAL</span>
              </div>

              {/* Completion bar */}
              <div className="shrink-0" style={{ width: 120 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: member.rate > 0 ? '#BF4A2A' : '#C4BDB1' }}>
                    {member.rate}%
                  </span>
                </div>
                <div className="w-full h-px" style={{ background: 'rgba(26,22,18,0.08)' }}>
                  <div style={{ width: `${member.rate}%`, height: '100%', background: member.rate >= 80 ? '#4A6B3A' : member.rate >= 40 ? '#BF4A2A' : '#C4BDB1', transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* Score */}
              <div className="shrink-0 text-right" style={{ width: 60 }}>
                <span style={{
                  fontFamily: '"Fraunces", serif', fontWeight: 800, fontSize: 18,
                  letterSpacing: '-0.02em', lineHeight: 1,
                  color: idx === 0 ? '#BF4A2A' : idx === 1 ? '#a0a0a0' : idx === 2 ? '#8b7355' : '#C4BDB1',
                }}>
                  {member.score}
                </span>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="py-24 text-center" style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C4BDB1' }}>
            No team members yet.
          </div>
        )}
      </div>

      {/* ── Score legend ── */}
      <div className="px-12 py-6 flex items-center gap-8" style={{ borderTop: '1px solid rgba(26,22,18,0.05)' }}>
        <span style={{ fontSize: 7, fontFamily: '"Fraunces", serif', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C4BDB1' }}>Score formula</span>
        {[
          { label: 'Task done', value: '×10' },
          { label: 'In progress', value: '×4' },
          { label: 'Completion %', value: '×1' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#BF4A2A' }}>{value}</span>
            <span style={{ fontSize: 8, fontFamily: '"Inter", sans-serif', color: '#C4BDB1' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

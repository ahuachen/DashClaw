'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Archive, CheckCheck, X, ArrowLeft,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { StatCompact } from '../components/ui/Stat';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { isDemoMode } from '../lib/isDemoMode';
import { useRealtime } from '../hooks/useRealtime';

import { TABS } from './_components/helpers';
import MessageList from './_components/MessageList';
import ThreadList from './_components/ThreadList';
import DocList from './_components/DocList';
import MessageDetail from './_components/MessageDetail';
import DocDetail from './_components/DocDetail';
import ComposeModal from './_components/ComposeModal';
import ThreadConversation from './_components/ThreadConversation';
import SmartInbox from './_components/SmartInbox';
import CreateThreadForm from './_components/CreateThreadForm';

export default function MessagesPage() {
  const { agentId: filterAgentId } = useAgentFilter();
  const isDemo = isDemoMode();
  const [tab, setTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({ unread: 0, today: 0, activeThreads: 0, docCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composePrefill, setComposePrefill] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const threadConvRef = useRef({ current: null });

  // ── Data fetching ─────────────────────────────────────────────

  const fetchMessages = useCallback(async (direction) => {
    const params = new URLSearchParams({ direction, limit: '50' });
    if (filterAgentId) params.set('agent_id', filterAgentId);
    const res = await fetch(`/api/messages?${params}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  }, [filterAgentId]);

  const fetchThreads = useCallback(async () => {
    const params = new URLSearchParams({ limit: '20' });
    if (filterAgentId) params.set('agent_id', filterAgentId);
    const res = await fetch(`/api/messages/threads?${params}`);
    if (!res.ok) throw new Error('Failed to fetch threads');
    return res.json();
  }, [filterAgentId]);

  const fetchDocs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '20' });
    const res = await fetch(`/api/messages/docs?${params}`);
    if (!res.ok) throw new Error('Failed to fetch docs');
    return res.json();
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [inboxData, sentData, threadData, docData] = await Promise.all([
        fetchMessages('inbox'),
        fetchMessages('sent'),
        fetchThreads(),
        fetchDocs(),
      ]);

      const currentMessages = tab === 'sent' ? sentData.messages : inboxData.messages;
      setMessages(currentMessages);
      setThreads(threadData.threads);
      setDocs(docData.docs);

      // Sync selected message with fresh server data
      setSelected(prev => {
        if (!prev) return prev;
        const fresh = currentMessages.find(m => m.id === prev.id)
          || threadData.threads.find(t => t.id === prev.id)
          || docData.docs.find(d => d.id === prev.id);
        return fresh || prev;
      });

      const today = new Date().toISOString().split('T')[0];
      const todayCount = [...inboxData.messages, ...sentData.messages].filter(
        m => m.created_at?.startsWith(today)
      ).length;

      setStats({
        unread: inboxData.unread_count || 0,
        today: todayCount,
        activeThreads: threadData.threads.filter(t => t.status === 'open').length,
        docCount: docData.total || 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, fetchMessages, fetchThreads, fetchDocs]);

  // Agents for compose dropdown
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAgents(d.agents || []))
      .catch(() => {});
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Refetch when tab switches between inbox/sent
  useEffect(() => {
    if (tab === 'inbox' || tab === 'sent') {
      fetchMessages(tab).then(d => setMessages(d.messages)).catch(() => {});
    }
  }, [tab, fetchMessages]);

  // ── SSE real-time ─────────────────────────────────────────────

  useRealtime(useCallback((event, payload) => {
    if (event !== 'message.created' || !payload) return;
    // Dedup and prepend to inbox
    setMessages(prev => {
      if (prev.some(m => m.id === payload.id)) return prev;
      if (filterAgentId && payload.from_agent_id !== filterAgentId && payload.to_agent_id !== filterAgentId) {
        return prev;
      }
      return [payload, ...prev];
    });
    setStats(prev => ({
      ...prev,
      unread: prev.unread + 1,
      today: prev.today + 1,
    }));
    // Forward to thread conversation if open
    if (threadConvRef.current) {
      threadConvRef.current(payload);
    }
  }, [filterAgentId]));

  // ── Actions ───────────────────────────────────────────────────

  async function handleSend(payload) {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Send failed');
      throw new Error(err.error || 'Send failed');
    }
    fetchAll();
  }

  async function handleMarkRead(msgId) {
    // Optimistically update the selected message and message list
    const now = new Date().toISOString();
    setSelected(prev => prev?.id === msgId ? { ...prev, is_read: true, status: prev.to_agent_id === null ? prev.status : 'read', read_at: now } : prev);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_read: true, status: m.to_agent_id === null ? m.status : 'read', read_at: now } : m));
    setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));

    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: [msgId], action: 'read', agent_id: filterAgentId || 'dashboard' }),
    });
    fetchAll();
  }

  const handleArchive = useCallback(async (msgId) => {
    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: [msgId], action: 'archive', agent_id: filterAgentId || 'dashboard' }),
    });
    setSelected(null);
    fetchAll();
  }, [filterAgentId, fetchAll]);

  async function handleMarkAllRead() {
    const unread = messages.filter(m => !m.is_read && m.status === 'sent');
    if (unread.length === 0) return;
    const unreadIds = new Set(unread.map(m => m.id));
    const now = new Date().toISOString();

    // Optimistic update
    setMessages(prev => prev.map(m => unreadIds.has(m.id) ? { ...m, is_read: true, status: m.to_agent_id === null ? m.status : 'read', read_at: now } : m));
    setSelected(prev => prev && unreadIds.has(prev.id) ? { ...prev, is_read: true, status: prev.to_agent_id === null ? prev.status : 'read', read_at: now } : prev);
    setStats(prev => ({ ...prev, unread: 0 }));

    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: unread.map(m => m.id), action: 'read', agent_id: filterAgentId || 'dashboard' }),
    });
    fetchAll();
  }

  async function handleArchiveAll() {
    if (messages.length === 0) return;
    if (!confirm(`Archive ${messages.length} message(s)?`)) return;
    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_ids: messages.map(m => m.id), action: 'archive', agent_id: filterAgentId || 'dashboard' }),
    });
    setSelected(null);
    fetchAll();
  }

  function selectItem(item, type) {
    setSelected(item);
    setSelectedType(type);
  }

  const handleViewThread = useCallback((threadId) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setTab('threads');
      setSelected(thread);
      setSelectedType('thread');
    }
  }, [threads]);

  const handleReply = useCallback((message) => {
    if (message.thread_id) {
      handleViewThread(message.thread_id);
    } else {
      setComposePrefill({
        to: message.from_agent_id,
        subject: message.subject ? `Re: ${message.subject}` : '',
        type: message.message_type,
      });
      setShowCompose(true);
    }
  }, [handleViewThread]);

  function handleMessageClick(msg) {
    if (msg.thread_id) {
      handleViewThread(msg.thread_id);
    } else {
      selectItem(msg, 'message');
    }
  }

  // ── Current list for keyboard nav ─────────────────────────────

  const currentList = tab === 'inbox' || tab === 'sent' ? messages
    : tab === 'threads' ? threads
    : docs;

  // ── Keyboard navigation ───────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      // Skip when focused on interactive elements or compose modal open
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (showCompose) return;

      switch (e.key) {
        case 'j': {
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = Math.min(prev + 1, currentList.length - 1);
            if (currentList[next]) {
              const type = tab === 'threads' ? 'thread' : tab === 'docs' ? 'doc' : 'message';
              selectItem(currentList[next], type);
            }
            return next;
          });
          break;
        }
        case 'k': {
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            if (currentList[next]) {
              const type = tab === 'threads' ? 'thread' : tab === 'docs' ? 'doc' : 'message';
              selectItem(currentList[next], type);
            }
            return next;
          });
          break;
        }
        case 'r': {
          if (selected && selectedType === 'message') {
            e.preventDefault();
            handleReply(selected);
          }
          break;
        }
        case 'e': {
          if (selected && selectedType === 'message') {
            e.preventDefault();
            handleArchive(selected.id);
          }
          break;
        }
        case 'Enter': {
          if (selected && selectedType === 'message' && selected.thread_id) {
            e.preventDefault();
            handleViewThread(selected.thread_id);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelected(null);
          setSelectedType(null);
          setSelectedIndex(-1);
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentList, selected, selectedType, showCompose, tab, handleArchive, handleReply, handleViewThread]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <PageLayout
      title="Messages"
      subtitle="Agent-to-agent communication"
      breadcrumbs={['Dashboard', 'Messages']}
      actions={
        <button
          onClick={() => { setComposePrefill(null); setShowCompose(true); }}
          disabled={isDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-brand text-white hover:bg-brand/90 transition-colors"
        >
          <Plus size={14} /> Compose
        </button>
      }
    >
      {isDemo && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-300 text-sm">
          Demo mode: messaging is read-only.
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Unread" value={stats.unread} color="text-brand" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Today" value={stats.today} color="text-blue-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Active Threads" value={stats.activeThreads} color="text-emerald-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Shared Docs" value={stats.docCount} color="text-white" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[rgba(255,255,255,0.06)] pb-px">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null); setSelectedIndex(-1); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                active
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'inbox' && stats.unread > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-brand/20 text-brand">
                  {stats.unread}
                </span>
              )}
              {t.key === 'threads' && stats.activeThreads > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400">
                  {stats.activeThreads}
                </span>
              )}
            </button>
          );
        })}
        {tab === 'inbox' && messages.length > 0 && (
          <div className="ml-auto flex gap-2">
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[rgba(255,255,255,0.06)] text-zinc-300 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <CheckCheck size={12} /> Mark All Read
              </button>
            )}
            <button
              onClick={handleArchiveAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[rgba(255,255,255,0.06)] text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Archive size={12} /> Archive All
            </button>
          </div>
        )}
        {tab === 'threads' && !isDemo && (
          <div className="ml-auto">
            <button
              onClick={() => setShowCreateThread(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
            >
              <Plus size={12} /> New Thread
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-zinc-500 py-12 text-sm">Loading messages...</div>
      ) : selectedType === 'thread' && selected ? (
        /* Full-width thread conversation view */
        <Card hover={false}>
          <CardContent className="pt-4">
            <button
              onClick={() => { setSelected(null); setSelectedType(null); setSelectedIndex(-1); }}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-3 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Threads
            </button>
            <ThreadConversation
              thread={selected}
              filterAgentId={filterAgentId}
              onNewMessage={threadConvRef}
              fullWidth
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4">
          {/* Main list */}
          <div className={`flex-1 min-w-0 ${selected ? 'hidden md:block md:w-2/3' : ''}`}>
            {tab === 'inbox' ? (
              <SmartInbox
                messages={messages}
                onSelect={handleMessageClick}
                selectedId={selectedType === 'message' ? selected?.id : null}
                onReply={handleReply}
                onMarkRead={handleMarkRead}
                onArchive={handleArchive}
              />
            ) : tab === 'sent' ? (
              <MessageList
                messages={messages}
                onSelect={(m) => selectItem(m, 'message')}
                selectedId={selectedType === 'message' ? selected?.id : null}
                isSent
              />
            ) : tab === 'threads' ? (
              <div>
                {showCreateThread && (
                  <CreateThreadForm
                    filterAgentId={filterAgentId}
                    onCreated={(thread) => {
                      setShowCreateThread(false);
                      setThreads(prev => [thread, ...prev]);
                      selectItem(thread, 'thread');
                    }}
                    onCancel={() => setShowCreateThread(false)}
                  />
                )}
                <ThreadList
                  threads={threads}
                  onSelect={(t) => selectItem(t, 'thread')}
                  selectedId={selectedType === 'thread' ? selected?.id : null}
                />
              </div>
            ) : (
              <DocList
                docs={docs}
                onSelect={(d) => selectItem(d, 'doc')}
                selectedId={selectedType === 'doc' ? selected?.id : null}
              />
            )}
          </div>

          {/* Detail panel */}
          {selected && selectedType !== 'thread' && (
            <div className="w-full md:w-1/3 min-w-[300px]">
              <Card hover={false}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500 uppercase tracking-wide">
                      {selectedType === 'message' ? 'Message' : 'Document'}
                    </span>
                    <button onClick={() => { setSelected(null); setSelectedIndex(-1); }} className="text-zinc-500 hover:text-zinc-300">
                      <X size={14} />
                    </button>
                  </div>

                  {selectedType === 'message' && (
                    <MessageDetail
                      message={selected}
                      onMarkRead={handleMarkRead}
                      onArchive={handleArchive}
                      onReply={handleReply}
                      onViewThread={handleViewThread}
                    />
                  )}
                  {selectedType === 'doc' && <DocDetail doc={selected} />}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="hidden md:flex items-center justify-center gap-3 mt-4 text-xs text-zinc-600">
        <span><kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">j</kbd>/<kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">k</kbd> navigate</span>
        <span className="text-zinc-700">·</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">r</kbd> reply</span>
        <span className="text-zinc-700">·</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">e</kbd> archive</span>
        <span className="text-zinc-700">·</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">Enter</kbd> open thread</span>
        <span className="text-zinc-700">·</span>
        <span><kbd className="px-1 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-zinc-500 font-mono">Esc</kbd> close</span>
      </div>

      {/* Compose modal */}
      <ComposeModal
        show={showCompose}
        onClose={() => { setShowCompose(false); setComposePrefill(null); }}
        agents={agents}
        threads={threads}
        filterAgentId={filterAgentId}
        isDemo={isDemo}
        onSend={handleSend}
        prefill={composePrefill}
      />
    </PageLayout>
  );
}


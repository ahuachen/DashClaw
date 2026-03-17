'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [permission, setPermission] = useState('default');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        addNotification('success', 'Notifications enabled.');
      }
    }
  };

  const addNotification = useCallback((type, message, title = 'DashClaw') => {
    const newNotif = {
      id: Date.now(),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 20));

    if (permission === 'granted' && type !== 'info') {
      new Notification(title, { body: message });
    }
  }, [permission]);

  // Listen to real-time SSE events for governance notifications
  useRealtime(useCallback((event, payload) => {
    // Approval required — an agent is waiting for human decision
    if (event === 'action.created') {
      const action = payload?.action || payload;
      if (action?.status === 'pending_approval') {
        const agentName = action.agent_name || action.agent_id || 'An agent';
        const goal = action.declared_goal || action.action_type || 'action';
        addNotification('warning', `${agentName} needs approval: ${goal}`, 'Approval Required');
      }
    }

    // Guard blocked an action
    if (event === 'guard.decision.created') {
      const decision = payload?.decision;
      if (decision?.decision === 'block') {
        const agentName = decision.agent_id || 'An agent';
        addNotification('error', `Action blocked for ${agentName}`, 'Guard Policy');
      }
    }

    // Risk signal detected
    if (event === 'signal.detected') {
      const signalType = (payload?.type || 'risk signal').replace(/_/g, ' ');
      addNotification('error', `${signalType} detected`, 'Risk Signal');
    }
  }, [addNotification]));

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'error': return <XCircle size={14} className="text-red-400" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-400" />;
      case 'success': return <CheckCircle2 size={14} className="text-green-400" />;
      default: return <Info size={14} className="text-blue-400" />;
    }
  };

  const getTypeBorder = (type) => {
    switch (type) {
      case 'error': return 'border-l-red-500';
      case 'warning': return 'border-l-yellow-500';
      case 'success': return 'border-l-green-500';
      default: return 'border-l-blue-500';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors duration-150"
      >
        <Bell size={18} className="text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 w-80 bg-surface-elevated border border-[rgba(255,255,255,0.06)] rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            <div className="flex gap-3">
              {permission !== 'granted' && (
                <button onClick={requestPermission} className="text-xs text-brand hover:text-brand-hover transition-colors">
                  Enable
                </button>
              )}
              <button onClick={markAllRead} className="text-xs text-zinc-500 hover:text-white transition-colors">
                Mark read
              </button>
              <button onClick={clearAll} className="text-xs text-zinc-500 hover:text-white transition-colors">
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-zinc-500">
                <Bell size={24} className="mb-2 text-zinc-600" />
                <span className="text-sm">No notifications</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-l-2 ${getTypeBorder(notif.type)} ${!notif.read ? 'bg-white/[0.02]' : ''} transition-colors`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 flex-shrink-0">{getTypeIcon(notif.type)}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white">{notif.title}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">{notif.message}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">{notif.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {permission !== 'granted' && (
            <div className="px-4 py-2.5 border-t border-[rgba(255,255,255,0.06)] text-center">
              <button onClick={requestPermission} className="text-xs text-brand hover:text-brand-hover transition-colors">
                Enable browser notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bug, Search, RotateCw, Shield, AlertTriangle, CheckCircle2, Clock, Inbox, Play } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';

const SCOPES = [
  'All Tabs',
  'Actions',
  'Security',
  'Messages',
  'Routing',
  'Compliance',
  'Policies',
  'Workflows',
];

const SEVERITY_CONFIG = {
  critical: { variant: 'error', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  high:     { variant: 'warning', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  medium:   { variant: 'warning', color: 'text-amber-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  low:      { variant: 'success', color: 'text-emerald-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

export default function BugHunterPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedScope, setSelectedScope] = useState('All Tabs');
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [stats, setStats] = useState({ totalScans: 0, issuesFound: 0, resolved: 0, open: 0 });
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/bug-hunter');
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      if (data.history) setScanHistory(data.history);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch bug hunter data:', error);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (Array.isArray(data)) {
        setAgents(data);
      } else if (data.agents && Array.isArray(data.agents)) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAgents();
  }, [fetchData, fetchAgents]);

  const startScan = async () => {
    if (!selectedAgent) return;
    setScanning(true);
    try {
      const res = await fetch('/api/bug-hunter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: selectedAgent, scope: selectedScope }),
      });
      const data = await res.json();
      if (data.findings) setFindings(data.findings);
      // Refresh stats and history after scan
      await fetchData();
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const getSeverityVariant = (severity) => {
    return SEVERITY_CONFIG[severity]?.variant || 'default';
  };

  const getSeverityColor = (severity) => {
    return SEVERITY_CONFIG[severity]?.color || 'text-zinc-400';
  };

  return (
    <PageLayout
      title="Bug Hunter"
      subtitle={`Automated Platform Quality Scanner${lastUpdated ? ` \u2014 Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Bug Hunter']}
      actions={
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
        >
          <RotateCw size={14} />
          Refresh
        </button>
      }
    >
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <StatCompact label="Total Scans" value={stats.totalScans} />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <StatCompact label="Issues Found" value={stats.issuesFound} color="text-amber-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <StatCompact label="Resolved" value={stats.resolved} color="text-emerald-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <StatCompact label="Open" value={stats.open} color="text-red-400" />
          </CardContent>
        </Card>
      </div>

      {/* Run Scan Section */}
      <Card className="mb-6">
        <CardHeader title="Run Scan" icon={Search} />
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Agent Selector */}
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg focus:outline-none focus:border-brand/50 transition-colors"
              >
                <option value="">Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.agent_id || agent.id} value={agent.agent_id || agent.id}>
                    {agent.name || agent.agent_id || agent.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope Selector */}
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Scan Scope</label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="w-full px-3 py-2 text-sm text-zinc-200 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg focus:outline-none focus:border-brand/50 transition-colors"
              >
                {SCOPES.map((scope) => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
            </div>

            {/* Start Scan Button */}
            <div className="flex items-end">
              <button
                onClick={startScan}
                disabled={!selectedAgent || scanning}
                className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors duration-150 flex items-center gap-2 whitespace-nowrap"
              >
                {scanning ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Start Scan
                  </>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      <Card className="mb-6">
        <CardHeader title="Findings" icon={Bug} count={findings.length > 0 ? findings.length : undefined} />
        <CardContent>
          {findings.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No findings yet"
              description="Run a scan to discover potential issues across your platform."
            />
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {findings.map((finding, index) => (
                <div key={finding.id || index} className="bg-surface-tertiary rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" size="xs">{finding.category}</Badge>
                      <Badge variant={getSeverityVariant(finding.severity)} size="xs">
                        {finding.severity?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock size={10} />
                      {finding.timestamp ? new Date(finding.timestamp).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-200 mb-1">{finding.description}</div>
                  {finding.location && (
                    <div className="text-xs text-zinc-500 font-mono">{finding.location}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card>
        <CardHeader title="Scan History" icon={Clock} count={scanHistory.length > 0 ? scanHistory.length : undefined} />
        <CardContent>
          {scanHistory.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No scan history"
              description="Completed scans will appear here."
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {scanHistory.map((scan, index) => (
                <div key={scan.scan_id || index} className="flex items-center justify-between bg-surface-tertiary rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${scan.status === 'completed' ? 'bg-green-400' : scan.status === 'running' ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-500'}`} />
                    <div>
                      <div className="text-sm text-zinc-200">{scan.scope || 'All Tabs'}</div>
                      <div className="text-[10px] text-zinc-500">{scan.agent_name || scan.agent_id || 'Unknown Agent'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-zinc-400">{scan.findings_count ?? 0} findings</div>
                      <div className="text-[10px] text-zinc-500">
                        {scan.created_at ? new Date(scan.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                    <Badge
                      variant={scan.status === 'completed' ? 'success' : scan.status === 'running' ? 'warning' : 'default'}
                      size="xs"
                    >
                      {scan.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}


'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import { LayoutGrid, X, RotateCcw } from 'lucide-react';
import { loadLayouts, saveLayouts, loadNamedLayouts, saveNamedLayout, deleteNamedLayout } from '../lib/dashboardLayoutState';

import RiskSignalsCard from './RiskSignalsCard';
import OpenLoopsCard from './OpenLoopsCard';
import RecentActionsCard from './RecentActionsCard';
import ProjectsCard from './ProjectsCard';
import GoalsChart from './GoalsChart';
import LearningStatsCard from './LearningStatsCard';
import FollowUpsCard from './FollowUpsCard';
import CalendarWidget from './CalendarWidget';
import IntegrationsCard from './IntegrationsCard';
import MemoryHealthCard from './MemoryHealthCard';
import InspirationCard from './InspirationCard';
import ContextCard from './ContextCard';
import TokenBudgetCard from './TokenBudgetCard';
import TokenChart from './TokenChart';
import ActivityTimeline from './ActivityTimeline';
import OnboardingChecklist from './OnboardingChecklist';
import CapabilityHighlightsCard from './CapabilityHighlightsCard';
import RecentMessagesCard from './RecentMessagesCard';
import FleetPresenceCard from './FleetPresenceCard';
import EvalScoreCard from './EvalScoreCard';
import PromptStatsCard from './PromptStatsCard';
import FeedbackCard from './FeedbackCard';
import DriftCard from './DriftCard';
import VelocityCard from './VelocityCard';
import ScoringProfileCard from './ScoringProfileCard';

const CARD_COMPONENTS = {
  'risk-signals': RiskSignalsCard,
  'open-loops': OpenLoopsCard,
  'recent-actions': RecentActionsCard,
  'recent-messages': RecentMessagesCard,
  'fleet-presence': FleetPresenceCard,
  'projects': ProjectsCard,
  'goals': GoalsChart,
  'learning': LearningStatsCard,
  'velocity': VelocityCard,
  'scoring': ScoringProfileCard,
  'follow-ups': FollowUpsCard,
  'calendar': CalendarWidget,
  'context': ContextCard,
  'token-budget': TokenBudgetCard,
  'memory-health': MemoryHealthCard,
  'token-chart': TokenChart,
  'integrations': IntegrationsCard,
  'inspiration': InspirationCard,
  'activity-timeline': ActivityTimeline,
  'eval-scores': EvalScoreCard,
  'prompt-stats': PromptStatsCard,
  'feedback': FeedbackCard,
  'drift': DriftCard,
};

const CARD_LABELS = {
  'risk-signals': 'Risk Signals',
  'fleet-presence': 'Fleet Presence',
  'recent-actions': 'Recent Actions',
  'recent-messages': 'Messages',
  'open-loops': 'Open Loops',
  'follow-ups': 'Follow-Ups',
  'activity-timeline': 'Activity Timeline',
  'eval-scores': 'Evaluations',
  'prompt-stats': 'Prompts',
  'feedback': 'Feedback',
  'drift': 'Drift Detection',
  'scoring': 'Scoring',
  'velocity': 'Learning Velocity',
  'learning': 'Learning Stats',
  'goals': 'Goals',
  'projects': 'Projects',
  'context': 'Context',
  'token-budget': 'Token Budget',
  'memory-health': 'Memory Health',
  'calendar': 'Calendar',
  'token-chart': 'Token Chart',
  'inspiration': 'Inspiration',
  'integrations': 'Integrations'
};

const SHARED_CONSTRAINTS = { maxW: 4, maxH: 8, minW: 1, minH: 2 };

const DEFAULT_LAYOUTS = {
  lg: [
    // Row 1: Fleet and decision tiles
    { i: 'fleet-presence',    x: 0, y: 0,  w: 2, h: 4, ...SHARED_CONSTRAINTS },
    { i: 'recent-actions',    x: 2, y: 0,  w: 2, h: 3, ...SHARED_CONSTRAINTS },

    // Row 2: Risk + timeline start
    { i: 'risk-signals',      x: 0, y: 4,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'activity-timeline', x: 0, y: 7,  w: 2, h: 4, ...SHARED_CONSTRAINTS, minW: 2 },
    { i: 'open-loops',        x: 2, y: 7,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'follow-ups',        x: 3, y: 7,  w: 1, h: 2, ...SHARED_CONSTRAINTS },

    // Row 4: Intelligence
    { i: 'velocity',          x: 2, y: 9,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'learning',          x: 3, y: 9,  w: 1, h: 2, ...SHARED_CONSTRAINTS },

    // Row 5: Quality and evaluation
    { i: 'eval-scores',       x: 0, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'feedback',          x: 1, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'drift',             x: 2, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'scoring',           x: 3, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },

    // Row 6: Communication
    { i: 'prompt-stats',      x: 0, y: 13, w: 2, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'recent-messages',   x: 2, y: 13, w: 2, h: 2, ...SHARED_CONSTRAINTS },

    // Row 7: Goals and projects
    { i: 'goals',             x: 0, y: 15, w: 2, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'projects',          x: 2, y: 15, w: 2, h: 3, ...SHARED_CONSTRAINTS },

    // Row 8: Supporting tools
    { i: 'context',           x: 0, y: 18, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'token-budget',      x: 1, y: 18, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'memory-health',     x: 2, y: 18, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'calendar',          x: 3, y: 18, w: 1, h: 3, ...SHARED_CONSTRAINTS },

    // Row 9: Supplemental
    { i: 'token-chart',       x: 0, y: 20, w: 2, h: 2, ...SHARED_CONSTRAINTS, minW: 2 },
    { i: 'inspiration',       x: 2, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'integrations',      x: 3, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
  ],
  md: [
    { i: 'fleet-presence',    x: 0, y: 0,  w: 2, h: 4, ...SHARED_CONSTRAINTS },
    { i: 'risk-signals',      x: 0, y: 4,  w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'recent-actions',    x: 1, y: 4,  w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'activity-timeline', x: 0, y: 7,  w: 2, h: 4, ...SHARED_CONSTRAINTS, minW: 2 },
    { i: 'open-loops',        x: 0, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'follow-ups',        x: 1, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'velocity',          x: 0, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'learning',          x: 1, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'eval-scores',       x: 0, y: 15, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'feedback',          x: 1, y: 15, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'drift',             x: 0, y: 17, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'scoring',           x: 1, y: 17, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'prompt-stats',      x: 0, y: 19, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'recent-messages',   x: 1, y: 19, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'goals',             x: 0, y: 21, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'projects',          x: 1, y: 21, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'context',           x: 0, y: 24, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'token-budget',      x: 1, y: 24, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'memory-health',     x: 0, y: 26, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'calendar',          x: 1, y: 26, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'token-chart',       x: 0, y: 29, w: 2, h: 2, ...SHARED_CONSTRAINTS, minW: 2 },
    { i: 'inspiration',       x: 0, y: 31, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'integrations',      x: 1, y: 31, w: 1, h: 2, ...SHARED_CONSTRAINTS },
  ],
  sm: [
    { i: 'fleet-presence',    x: 0, y: 0,  w: 1, h: 4, ...SHARED_CONSTRAINTS },
    { i: 'risk-signals',      x: 0, y: 4,  w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'recent-actions',    x: 0, y: 7,  w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'activity-timeline', x: 0, y: 10, w: 1, h: 4, ...SHARED_CONSTRAINTS },
    { i: 'open-loops',        x: 0, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'follow-ups',        x: 0, y: 16, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'velocity',          x: 0, y: 18, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'learning',          x: 0, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'eval-scores',       x: 0, y: 22, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'feedback',          x: 0, y: 24, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'drift',             x: 0, y: 26, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'scoring',           x: 0, y: 28, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'prompt-stats',      x: 0, y: 30, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'recent-messages',   x: 0, y: 32, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'goals',             x: 0, y: 34, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'projects',          x: 0, y: 37, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'context',           x: 0, y: 40, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'token-budget',      x: 0, y: 42, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'memory-health',     x: 0, y: 44, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'calendar',          x: 0, y: 46, w: 1, h: 3, ...SHARED_CONSTRAINTS },
    { i: 'token-chart',       x: 0, y: 49, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'inspiration',       x: 0, y: 51, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    { i: 'integrations',      x: 0, y: 53, w: 1, h: 2, ...SHARED_CONSTRAINTS },
  ],
};

const PRESET_LAYOUTS = {
  'Operations Focus': {
    lg: [
      // Fleet status bar
      { i: 'fleet-presence',    x: 0, y: 0,  w: 2, h: 4, ...SHARED_CONSTRAINTS },
      // Core ops
      { i: 'risk-signals',      x: 0, y: 4,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'recent-actions',    x: 2, y: 0,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'follow-ups',        x: 0, y: 7,  w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'open-loops',        x: 2, y: 7,  w: 2, h: 2, ...SHARED_CONSTRAINTS },
      // Timeline + quality row
      { i: 'activity-timeline', x: 0, y: 9,  w: 2, h: 4, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'drift',             x: 2, y: 9,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'eval-scores',       x: 3, y: 9,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'feedback',          x: 2, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'scoring',           x: 3, y: 11, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Intelligence
      { i: 'velocity',          x: 0, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'learning',          x: 1, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'prompt-stats',      x: 2, y: 13, w: 2, h: 2, ...SHARED_CONSTRAINTS },
      // Projects + goals
      { i: 'projects',          x: 0, y: 15, w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'goals',             x: 2, y: 15, w: 2, h: 3, ...SHARED_CONSTRAINTS },
      // Supporting
      { i: 'recent-messages',   x: 0, y: 18, w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'calendar',          x: 2, y: 18, w: 1, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'context',           x: 3, y: 18, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'token-budget',      x: 0, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'memory-health',     x: 1, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'token-chart',       x: 2, y: 21, w: 2, h: 2, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'integrations',      x: 0, y: 22, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'inspiration',       x: 1, y: 22, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    ],
  },
  'Analytics Focus': {
    lg: [
      // Wide analytics tiles up top
      { i: 'token-chart',       x: 0, y: 0,  w: 2, h: 3, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'activity-timeline', x: 2, y: 0,  w: 2, h: 4, ...SHARED_CONSTRAINTS, minW: 2 },
      // Quality metrics row
      { i: 'eval-scores',       x: 0, y: 3,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'feedback',          x: 1, y: 3,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'drift',             x: 0, y: 5,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'scoring',           x: 1, y: 5,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Learning
      { i: 'velocity',          x: 2, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'learning',          x: 3, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'prompt-stats',      x: 2, y: 6,  w: 2, h: 2, ...SHARED_CONSTRAINTS },
      // Goals and projects
      { i: 'goals',             x: 0, y: 7,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'projects',          x: 2, y: 8,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      // Ops signals
      { i: 'fleet-presence',    x: 0, y: 10, w: 2, h: 4, ...SHARED_CONSTRAINTS },
      { i: 'risk-signals',      x: 0, y: 14, w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'recent-actions',    x: 2, y: 10, w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'open-loops',        x: 0, y: 16, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'follow-ups',        x: 1, y: 16, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Supporting
      { i: 'token-budget',      x: 2, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'memory-health',     x: 3, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'recent-messages',   x: 0, y: 18, w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'calendar',          x: 2, y: 16, w: 1, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'context',           x: 3, y: 16, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'integrations',      x: 0, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'inspiration',       x: 1, y: 20, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    ],
  },
  'Compact Overview': {
    lg: [
      // Stats strip
      { i: 'fleet-presence',    x: 0, y: 0,  w: 2, h: 4, ...SHARED_CONSTRAINTS },
      // Compact row beside fleet
      { i: 'recent-actions',    x: 2, y: 0,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'follow-ups',        x: 3, y: 0,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'risk-signals',      x: 2, y: 2,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'open-loops',        x: 3, y: 2,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Quality compact row
      { i: 'eval-scores',       x: 0, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'feedback',          x: 1, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'drift',             x: 2, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'scoring',           x: 3, y: 4,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Intelligence row
      { i: 'velocity',          x: 0, y: 6,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'learning',          x: 1, y: 6,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'prompt-stats',      x: 2, y: 6,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'recent-messages',   x: 3, y: 6,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Goals and projects
      { i: 'goals',             x: 0, y: 8,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'projects',          x: 1, y: 8,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'token-budget',      x: 2, y: 8,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'memory-health',     x: 3, y: 8,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Wider tiles at the bottom
      { i: 'activity-timeline', x: 0, y: 10, w: 2, h: 3, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'token-chart',       x: 2, y: 10, w: 2, h: 3, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'calendar',          x: 0, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'context',           x: 1, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'integrations',      x: 2, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'inspiration',       x: 3, y: 13, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    ],
  },
  'Developer': {
    lg: [
      // Dev tools front and center
      { i: 'integrations',      x: 0, y: 0,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'context',           x: 2, y: 0,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'memory-health',     x: 0, y: 3,  w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'token-chart',       x: 2, y: 3,  w: 2, h: 3, ...SHARED_CONSTRAINTS, minW: 2 },
      { i: 'token-budget',      x: 0, y: 5,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'prompt-stats',      x: 1, y: 5,  w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Activity and actions
      { i: 'recent-actions',    x: 0, y: 7,  w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'activity-timeline', x: 2, y: 6,  w: 2, h: 4, ...SHARED_CONSTRAINTS, minW: 2 },
      // Signals and quality
      { i: 'fleet-presence',    x: 0, y: 10, w: 4, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'risk-signals',      x: 0, y: 12, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'open-loops',        x: 1, y: 12, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'drift',             x: 2, y: 12, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'eval-scores',       x: 3, y: 12, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'feedback',          x: 0, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'scoring',           x: 1, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'velocity',          x: 2, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'learning',          x: 3, y: 14, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      // Projects and planning
      { i: 'projects',          x: 0, y: 16, w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'goals',             x: 2, y: 16, w: 2, h: 3, ...SHARED_CONSTRAINTS },
      { i: 'follow-ups',        x: 0, y: 19, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'calendar',          x: 1, y: 19, w: 1, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'recent-messages',   x: 2, y: 19, w: 2, h: 2, ...SHARED_CONSTRAINTS },
      { i: 'inspiration',       x: 0, y: 21, w: 1, h: 2, ...SHARED_CONSTRAINTS },
    ],
  },
};

const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
const COLS = { lg: 4, md: 2, sm: 1 };
const ROW_HEIGHT = 80;

export { PRESET_LAYOUTS };

export default function DraggableDashboard({ activePreset, onPresetApplied }) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const [layoutKey, setLayoutKey] = useState(0);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [hiddenTiles, setHiddenTiles] = useState(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('dashclaw_hidden_tiles');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dashclaw_hidden_tiles', JSON.stringify(hiddenTiles));
  }, [hiddenTiles]);

  const initialLayouts = useMemo(() => {
    let layouts = DEFAULT_LAYOUTS;
    if (activePreset && PRESET_LAYOUTS[activePreset]) {
      layouts = PRESET_LAYOUTS[activePreset];
    } else {
      const saved = loadLayouts();
      if (saved) layouts = saved;
    }

    // Filter out hidden tiles from the layouts
    const filtered = {};
    Object.keys(layouts).forEach(bp => {
      filtered[bp] = layouts[bp].filter(item => !hiddenTiles.includes(item.i));
    });
    return filtered;
  }, [activePreset, hiddenTiles]);

  const handleLayoutChange = useCallback((_currentLayout, allLayouts) => {
    saveLayouts(allLayouts);
  }, []);

  const toggleTileVisibility = (id) => {
    setHiddenTiles(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const resetToDefault = () => {
    setHiddenTiles([]);
  };

  const isMobile = width < 768;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <OnboardingChecklist />
        </div>
        <button
          onClick={() => setIsCustomizeOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-surface-tertiary border border-border rounded-lg transition-colors ml-4 shrink-0"
        >
          <LayoutGrid size={14} />
          Customize
        </button>
      </div>

      <CapabilityHighlightsCard />

      {/* Draggable grid */}
      <div ref={containerRef}>
        {mounted ? (
          <ResponsiveGridLayout
            key={`grid-${layoutKey}-${activePreset || 'custom'}`}
            layouts={initialLayouts}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={ROW_HEIGHT}
            width={width}
            containerPadding={[0, 0]}
            margin={[16, 16]}
            compactType="vertical"
            useCSSTransforms={true}
            resizeHandles={['se']}
            isDraggable={!isMobile}
            isResizable={!isMobile}
            draggableCancel="a, button, input, textarea, select"
            onLayoutChange={handleLayoutChange}
          >
            {Object.entries(CARD_COMPONENTS)
              .filter(([key]) => !hiddenTiles.includes(key))
              .map(([key, Component]) => (
                <div key={key} className="h-full">
                  <Component />
                </div>
              ))}
          </ResponsiveGridLayout>
        ) : null}
      </div>

      {/* Customize Modal */}
      {isCustomizeOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsCustomizeOpen(false)}
        >
          <div 
            className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Customize Dashboard</h2>
                <p className="text-sm text-zinc-400 mt-1">Choose which tiles appear on your dashboard</p>
              </div>
              <button 
                onClick={() => setIsCustomizeOpen(false)}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.keys(CARD_COMPONENTS).map(id => {
                  const isVisible = !hiddenTiles.includes(id);
                  const label = CARD_LABELS[id] || id;
                  
                  return (
                    <div 
                      key={id}
                      onClick={() => toggleTileVisibility(id)}
                      className={`group p-3 rounded-xl border cursor-pointer transition-all ${
                        isVisible 
                          ? 'bg-brand/5 border-brand/20 hover:border-brand/40' 
                          : 'bg-[#111] border-white/5 opacity-50 hover:opacity-80 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isVisible ? 'text-white' : 'text-zinc-400'}`}>
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold">
                            {isVisible ? (
                              <span className="text-brand">Visible</span>
                            ) : (
                              <span className="text-zinc-600">Hidden</span>
                            )}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${isVisible ? 'bg-brand shadow-[0_0_8px_rgba(0,255,153,0.5)]' : 'bg-zinc-700'}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-between items-center bg-white/[0.02]">
              <button
                onClick={resetToDefault}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={12} />
                Reset to Default
              </button>
              <button
                onClick={() => setIsCustomizeOpen(false)}
                className="px-6 py-2 bg-brand text-black font-semibold rounded-lg hover:bg-brand-hover transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

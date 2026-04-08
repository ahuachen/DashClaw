'use client';

import { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { ListSkeleton } from './ui/Skeleton';
import { useTileSize, fitItems } from '../hooks/useTileSize';

export default function InspirationCard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ref: sizeRef, height: tileHeight } = useTileSize();

  const fetchData = async () => {
    try {
      const res = await fetch('/api/inspiration');
      const data = await res.json();
      if (data.ideas && Array.isArray(data.ideas)) {
        const formatted = data.ideas.map(idea => ({
          id: idea.id || 0,
          title: idea.title || 'Untitled',
          description: idea.description || '',
          funScore: idea.fun_factor || 0,
          learningScore: idea.learning_potential || 0,
          incomeScore: idea.income_potential || 0,
          totalScore: idea.score || ((idea.fun_factor || 0) + (idea.learning_potential || 0) + (idea.income_potential || 0))
        }));
        setIdeas(formatted.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTotalScoreVariant = (total) => {
    if (total >= 24) return 'success';
    if (total >= 20) return 'warning';
    return 'error';
  };

  const ITEM_H = 90;
  const maxVisible = tileHeight > 0 ? fitItems(tileHeight, ITEM_H) : 3;
  const visibleIdeas = ideas.slice(0, maxVisible);

  return (
    <Card className="h-full">
      <CardHeader title="Inspiration" icon={Lightbulb} count={ideas.length} />
      <CardContent>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas captured yet"
            description="Capture ideas via POST /api/inspiration"
          />
        ) : (
          <div ref={sizeRef} className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 space-y-2">
            {visibleIdeas.map((idea) => (
              <div
                key={idea.id}
                className="bg-surface-tertiary rounded-lg p-3 transition-colors duration-150"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-sm font-medium text-white truncate">{idea.title}</div>
                    {idea.description && (
                      <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                        {idea.description.substring(0, 80)}
                      </div>
                    )}
                  </div>
                  <Badge variant={getTotalScoreVariant(idea.totalScore)} size="xs">
                    {idea.totalScore}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  <div className="text-center">
                    <div className={`font-semibold tabular-nums ${getScoreColor(idea.funScore)}`}>{idea.funScore}</div>
                    <div className="text-zinc-500">Fun</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold tabular-nums ${getScoreColor(idea.learningScore)}`}>{idea.learningScore}</div>
                    <div className="text-zinc-500">Learn</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-semibold tabular-nums ${getScoreColor(idea.incomeScore)}`}>{idea.incomeScore}</div>
                    <div className="text-zinc-500">Income</div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

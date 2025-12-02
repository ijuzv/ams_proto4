import React, { useState, useRef, useEffect } from 'react';
import { TeamNode } from '@/hooks/useTeam';
import { TeamNodeCard } from './TeamNodeCard';
import { cn } from '@/lib/utils';
import { Plus, Minus, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TeamTreeProps {
  nodes: TeamNode[];
  searchTerm?: string;
}

export const TeamTree = ({ nodes, searchTerm }: TeamTreeProps) => {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.3));
  const handleResetZoom = () => {
    setScale(1);
    // Smooth scroll to top node when resetting zoom
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        left: (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2,
        behavior: 'smooth'
      });
    }
  };

  // Scroll to top node on mount or when nodes change
  useEffect(() => {
    if (containerRef.current && nodes && nodes.length > 0) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        if (containerRef.current) {
          // Smooth scroll to top and center horizontally
          containerRef.current.scrollTo({
            top: 0,
            left: (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [nodes]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5; // Scroll-fastness
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="relative w-full h-[calc(100vh-12rem)] bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2 bg-white/95 backdrop-blur-sm p-1.5 rounded-lg shadow-lg border border-slate-300">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResetZoom}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Draggable/Scrollable Container */}
      <div
        ref={containerRef}
        className={cn(
          "w-full h-full overflow-auto scrollbar-hide scroll-smooth",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
          className="min-w-fit min-h-fit p-10 inline-flex justify-center transition-transform duration-300 ease-in-out"
        >
          <div className="flex gap-8">
            {nodes.map(node => (
              <OrgChartNode key={node.id} node={node} forceExpand={!!searchTerm} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrgChartNode = ({ node, forceExpand }: { node: TeamNode, forceExpand: boolean }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  return (
    <div className="flex flex-col items-center">
      {/* Card Section */}
      <div className="relative z-10 mb-6 group transition-all duration-300 ease-in-out">
        <TeamNodeCard node={node} className="w-[200px] shadow-sm hover:shadow-md transition-all duration-300 ease-in-out border-t-4" />

        {/* Connection Line Down */}
        {hasChildren && expanded && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full h-6 w-px bg-border transition-all duration-300 ease-in-out"></div>
        )}

        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 translate-y-1/2 bottom-0 z-20",
              "flex items-center justify-center w-6 h-6 rounded-full border border-border bg-white shadow-sm",
              "hover:bg-slate-50 hover:text-primary transition-all duration-200 ease-in-out cursor-pointer",
              "hover:scale-110 active:scale-95"
            )}
          >
            {expanded ? (
              <Minus className="h-3 w-3 text-slate-500" />
            ) : (
              <Plus className="h-3 w-3 text-slate-500" />
            )}
          </button>
        )}
      </div>

      {/* Children Section */}
      {hasChildren && expanded && (
        <div className="flex relative pt-2 transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95">
          {/* Horizontal Connector Line */}
          {node.children.length > 1 && (
            <div className="absolute top-0 left-0 right-0 h-px bg-border mx-[calc(200px/2)] translate-y-[-1px] transition-all duration-300 ease-in-out"></div>
          )}

          {node.children.map((child) => (
            <div key={child.id} className="relative px-3 transition-all duration-300 ease-in-out">
              {/* Line Up from Child */}
              <div className="absolute left-1/2 -translate-x-1/2 top-[-8px] h-2 w-px bg-border transition-all duration-300 ease-in-out"></div>
              {/* Recursion */}
              <OrgChartNode node={child} forceExpand={forceExpand} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { TeamNode } from '@/hooks/useTeam';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/avatar/UserAvatar';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import { Briefcase, Clock } from 'lucide-react';

interface TeamNodeCardProps {
  node: TeamNode;
  onClick?: (node: TeamNode) => void;
  className?: string;
}

export const TeamNodeCard = ({ node, onClick, className }: TeamNodeCardProps) => {
  return (
    <Card
      className={cn(
        "p-3 flex flex-col items-center gap-2 cursor-pointer hover:shadow-xl transition-all duration-300 ease-in-out bg-white relative z-20",
        "hover:scale-105 hover:-translate-y-1",
        node.status === 'WFO' ? 'border-t-green-500' :
          node.status === 'WFH' ? 'border-t-blue-500' :
            node.status === 'LEAVE' ? 'border-t-red-500' : 'border-t-gray-300',
        className
      )}
      onClick={() => onClick?.(node)}
    >
      <div className="relative">
        <UserAvatar
          avatar={node.avatar}
          name={node.name}
          size="lg"
          className="border-2 border-white shadow-sm transition-transform duration-300 ease-in-out group-hover:scale-110"
        />
        <div className="absolute -bottom-1 -right-1">
          <StatusBadge status={node.status} className="shadow-sm" />
        </div>
      </div>

      <div className="text-center w-full">
        <h4 className="font-bold text-gray-900 truncate px-2" title={node.name}>{node.name}</h4>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1 mb-2">
          <Briefcase className="w-3 h-3" /> {node.designation || 'No Designation'}
        </p>

        {node.shift && (
          <div className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-slate-50 px-2 py-1 rounded-full border">
            <Clock className="w-3 h-3" /> {node.shift}
          </div>
        )}
      </div>
    </Card>
  );
};

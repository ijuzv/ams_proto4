'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTeamTree, TeamNode } from '@/hooks/useTeam';
import { TeamTree } from '@/components/team/TeamTree';
import { TeamToolbar } from '@/components/team/TeamToolbar';
import { Loader2 } from 'lucide-react';

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: nodes, isLoading, error } = useTeamTree('FULL');

  // Filter Logic
  const filterNodes = (nodes: TeamNode[]): TeamNode[] => {
    if (!nodes) return [];
    return nodes.map(node => {
      const matchesSearch = node.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || node.status === statusFilter;

      const filteredChildren = filterNodes(node.children);

      // If node matches criteria, OR if it has children that match (show path)
      if ((matchesSearch && matchesStatus) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    }).filter(Boolean) as TeamNode[];
  };

  const displayedNodes = filterNodes(nodes || []);

  if (authLoading || isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (error) return <div className="p-10 text-red-500 text-center">Failed to load team structure.</div>;

  return (
    <div className="container max-w-full w-full mx-auto justify-center py-4 pb-8 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Team Organization</h1>

      <TeamToolbar
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <div className="bg-white rounded-lg shadow-sm border">
        {displayedNodes.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No team members found matching your criteria.</p>
          </div>
        ) : (
          <TeamTree nodes={displayedNodes} searchTerm={search} />
        )}
      </div>
    </div>
  );
}

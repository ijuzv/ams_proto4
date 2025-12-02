import { useQuery } from '@tanstack/react-query';
import { teamApi } from '@/lib/api';

export interface TeamNode {
  id: number;
  name: string;
  designation: string | null;
  role: string;
  shift: string | null;
  status: string; // WFO, WFH, LEAVE, PENDING
  avatar?: string | null;
  children: TeamNode[];
}

export const useTeamTree = (mode: 'FULL' | 'MY_TEAM') => {
  return useQuery({
    queryKey: ['team-tree', mode],
    queryFn: () => teamApi.getTree(mode) as Promise<TeamNode[]>,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchInterval: 60000, // Refetch every minute to keep team status synchronized
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when connection is re-established
  });
};

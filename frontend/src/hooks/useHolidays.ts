import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/contexts/auth-context';

export interface Holiday {
  id: number;
  date: string;
  name: string;
  description?: string;
  isMandatory: boolean;
}

export interface CreateHolidayDto {
  date: string;
  name: string;
  description?: string;
  isMandatory?: boolean;
}

export interface UpdateHolidayDto extends Partial<CreateHolidayDto> { }

export function useHolidays() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
  });

  const { data: holidays, isLoading, error } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data } = await axios.get('http://localhost:3001/holidays', {
        headers: getHeaders(),
      });
      return data as Holiday[];
    },
  });

  const createHoliday = useMutation({
    mutationFn: async (newHoliday: CreateHolidayDto) => {
      const { data } = await axios.post('http://localhost:3001/holidays', newHoliday, {
        headers: getHeaders(),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const updateHoliday = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateHolidayDto }) => {
      const response = await axios.put(`http://localhost:3001/holidays/${id}`, data, {
        headers: getHeaders(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const deleteHoliday = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`http://localhost:3001/holidays/${id}`, {
        headers: getHeaders(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  return {
    holidays,
    isLoading,
    error,
    createHoliday,
    updateHoliday,
    deleteHoliday,
  };
}

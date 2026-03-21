import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, updateClubs } from '../lib/api';
import type { PlayerProfile, PlayerClub } from '../lib/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlayerProfile>) => updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateClubs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clubs: Omit<PlayerClub, 'id'>[]) => updateClubs(clubs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

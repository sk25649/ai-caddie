import { useQuery, useMutation } from '@tanstack/react-query';
import { generatePlaybook, generatePlaybookFromDescription, getPlaybook } from '../lib/api';
import type { GeneratePlaybookParams, GeneratePlaybookFromDescriptionParams } from '../lib/api';
import { cachePlaybook } from '../lib/storage';

export function useGeneratePlaybook() {
  return useMutation({
    mutationFn: (params: GeneratePlaybookParams) => generatePlaybook(params),
    onSuccess: (playbook) => {
      cachePlaybook(playbook);
    },
  });
}

export function useGeneratePlaybookFromDescription() {
  return useMutation({
    mutationFn: (params: GeneratePlaybookFromDescriptionParams) => generatePlaybookFromDescription(params),
    onSuccess: (playbook) => {
      cachePlaybook(playbook);
    },
  });
}

export function usePlaybook(id: string) {
  return useQuery({
    queryKey: ['playbook', id],
    queryFn: () => getPlaybook(id),
    enabled: !!id,
  });
}

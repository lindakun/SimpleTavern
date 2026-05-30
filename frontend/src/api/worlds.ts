/**
 * 世界书相关 API
 */

import { useApiClient } from './client';

export interface WorldListItem {
  file_id: string;
  name: string;
  entriesCount: number;
  extensions?: Record<string, unknown>;
}

export interface WorldDetail {
  file_id: string;
  name: string;
  entriesCount: number;
  promptText: string;
}

export function useWorldApi() {
  const { post } = useApiClient();

  return {
    listWorlds: () => post<WorldListItem[]>('/api/worlds/list'),
    getWorld: (fileId: string) =>
      post<WorldDetail>('/api/worlds/get', { file_id: fileId }),
  };
}

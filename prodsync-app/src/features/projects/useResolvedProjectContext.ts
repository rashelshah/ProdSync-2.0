import { useProject } from '@/context/ProjectContext'

export function useResolvedProjectContext() {
  return useProject()
}

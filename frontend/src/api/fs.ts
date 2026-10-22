import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type { FsListing } from './types.ts'

export function useFsListing(path: string | null) {
  return useQuery({
    queryKey: ['fs', path],
    queryFn: () => {
      const suffix = path ? `?path=${encodeURIComponent(path)}` : ''
      return apiFetch<FsListing>(`/fs/list${suffix}`)
    },
    staleTime: 0,
  })
}

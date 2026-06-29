import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResolvedProjectContext } from '@/features/projects/useResolvedProjectContext'
import { formatProjectPhase } from '@/features/workflow/projectWorkflow'
import { projectsService } from '@/services/projects.service'
import type { ProjectSearchResult } from '@/types'

const MIN_QUERY_LENGTH = 2
const SEARCH_DEBOUNCE_MS = 350

export function ProjectGlobalSearch() {
  const navigate = useNavigate()
  const { activeProjectId } = useResolvedProjectContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProjectSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const cacheRef = useRef(new Map<string, ProjectSearchResult[]>())
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!activeProjectId) {
      setResults([])
      setOpen(false)
      return
    }

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      controllerRef.current?.abort()
      setResults([])
      setOpen(false)
      setIsLoading(false)
      return
    }

    const cacheKey = `${activeProjectId}:${trimmedQuery.toLowerCase()}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResults(cached)
      setOpen(true)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timeoutId = window.setTimeout(() => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      void projectsService.searchProject(activeProjectId, trimmedQuery, controller.signal)
        .then(nextResults => {
          cacheRef.current.set(cacheKey, nextResults)
          setResults(nextResults)
          setOpen(true)
        })
        .catch(error => {
          if (error instanceof Error && error.name === 'AbortError') return
          setResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [activeProjectId, query])

  function handleSelect(result: ProjectSearchResult) {
    setQuery('')
    setOpen(false)
    navigate(result.path, {
      state: result.phase
        ? { phaseNotice: `This item belongs to the ${formatProjectPhase(result.phase)} phase.` }
        : undefined,
    })
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 pointer-events-auto">
      <span className="material-symbols-outlined text-[18px] text-zinc-400 dark:text-zinc-500">search</span>
      <input
        type="text"
        value={query}
        onChange={event => setQuery(event.target.value)}
        onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
        placeholder="Search the active project..."
        className="w-full min-w-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
      />
      {isLoading && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] overflow-hidden rounded-[24px] border border-zinc-200 bg-white/96 p-2 shadow-soft backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/96">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">No matching project items yet.</div>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {results.map(result => (
                <button
                  key={`${result.entityType}-${result.id}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-start justify-between gap-3 rounded-[18px] px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{result.title}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{result.subtitle}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{result.module}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

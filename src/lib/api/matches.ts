import type { Match, MatchInput } from '../matches'
import { request } from './client'

/** The API also returns `updatedAt`; the app doesn't need it. */
type ApiMatch = Match & { updatedAt?: number }

function strip(m: ApiMatch): Match {
  const copy = { ...m }
  delete copy.updatedAt
  return copy
}

/** Backend limit per import request. */
export const IMPORT_BATCH = 5000

export const matchesApi = {
  list: async (signal?: AbortSignal) =>
    (await request<ApiMatch[]>('GET', '/matches', { signal })).map(strip),

  /** Sends the client's `id` and `createdAt`, so retrying or undoing a delete is safe. */
  create: async (match: Match) => strip(await request<ApiMatch>('POST', '/matches', { body: match })),

  update: async (id: string, input: MatchInput) =>
    strip(
      await request<ApiMatch>('PUT', `/matches/${encodeURIComponent(id)}`, {
        body: {
          date: input.date,
          playerA: input.playerA,
          playerB: input.playerB,
          scoreA: input.scoreA,
          scoreB: input.scoreB,
          note: input.note,
        },
      }),
    ),

  remove: (id: string) => request<null>('DELETE', `/matches/${encodeURIComponent(id)}`),

  /** Merge by id on the server. Max IMPORT_BATCH per call. */
  import: (matches: Match[]) =>
    request<{ added: number; skipped: number }>('POST', '/matches/import', { body: { matches } }),
}

type RedisClientLike = {
  connect: () => Promise<void>
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, options?: { EX?: number }) => Promise<unknown>
  del: (key: string) => Promise<number>
  incr: (key: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<number>
  isOpen?: boolean
  on?: (event: string, listener: (...args: unknown[]) => void) => void
}

import { env } from '../utils/env'

type InMemoryEntry = {
  value: string
  expiresAt: number | null
}

const inMemoryStore = new Map<string, InMemoryEntry>()
let redisClientPromise: Promise<RedisClientLike | null> | null = null

function cleanupExpiredInMemoryKey(key: string) {
  const entry = inMemoryStore.get(key)
  if (!entry) {
    return null
  }

  if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
    inMemoryStore.delete(key)
    return null
  }

  return entry
}

async function getRedisClient(): Promise<RedisClientLike | null> {
  if (!env.redisUrl) {
    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const redisModule = require('redis') as {
          createClient: (options: { url: string }) => RedisClientLike
        }
        const client = redisModule.createClient({ url: env.redisUrl })

        client.on?.('error', error => {
          console.error('[cache][redis] client error', error)
        })

        if (!client.isOpen) {
          await client.connect()
        }

        return client
      } catch (error) {
        console.warn('[cache][redis] unavailable, falling back to in-memory cache', error)
        return null
      }
    })()
  }

  return redisClientPromise
}

export async function getCacheString(key: string) {
  const redis = await getRedisClient()
  if (redis) {
    return redis.get(key)
  }

  return cleanupExpiredInMemoryKey(key)?.value ?? null
}

export async function getCacheStrings(keys: string[]) {
  return Promise.all(keys.map(key => getCacheString(key)))
}

export async function setCacheString(key: string, value: string, ttlSeconds?: number) {
  const redis = await getRedisClient()
  if (redis) {
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, value, { EX: ttlSeconds })
      return
    }

    await redis.set(key, value)
    return
  }

  inMemoryStore.set(key, {
    value,
    expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
  })
}

export async function deleteCacheKey(key: string) {
  const redis = await getRedisClient()
  if (redis) {
    await redis.del(key)
    return
  }

  inMemoryStore.delete(key)
}

export async function getCacheJson<T>(key: string) {
  const raw = await getCacheString(key)
  if (!raw) {
    return null as T | null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    await deleteCacheKey(key)
    return null as T | null
  }
}

export async function setCacheJson(key: string, value: unknown, ttlSeconds?: number) {
  await setCacheString(key, JSON.stringify(value), ttlSeconds)
}

export async function incrementCacheCounter(key: string, ttlSeconds: number) {
  const redis = await getRedisClient()
  if (redis) {
    const nextValue = await redis.incr(key)
    if (nextValue === 1) {
      await redis.expire(key, ttlSeconds)
    }

    return nextValue
  }

  const current = Number(cleanupExpiredInMemoryKey(key)?.value ?? 0) + 1
  inMemoryStore.set(key, {
    value: String(current),
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
  return current
}

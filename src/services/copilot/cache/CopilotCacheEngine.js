/**
 * High-Performance LRU In-Memory & Redis-Ready Cache Engine for Health Copilot
 *
 * Implements intelligent caching for:
 * 1. Query Embeddings (eliminates redundant OpenAI embedding calls)
 * 2. Hybrid Retrieval Search Results (caches top-k chunk sets per query signature)
 * 3. Static Protocol Definitions & Triage Rule Catalogs
 * 4. Latency performance metrics collection
 */

const crypto = require('crypto');

class LruCache {
  constructor(maxSize = 500, defaultTtlMs = 1000 * 60 * 60) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  _hashKey(key) {
    if (typeof key === 'string' && key.length > 64) {
      return crypto.createHash('sha256').update(key).digest('hex');
    }
    return String(key).toLowerCase().trim();
  }

  get(key) {
    const hashed = this._hashKey(key);
    const item = this.cache.get(hashed);

    if (!item) {
      this.misses += 1;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(hashed);
      this.misses += 1;
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(hashed);
    this.cache.set(hashed, item);
    this.hits += 1;
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    const hashed = this._hashKey(key);

    if (this.cache.has(hashed)) {
      this.cache.delete(hashed);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (first item in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(hashed, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return true;
  }

  has(key) {
    return this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRatePct: total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0,
    };
  }
}

// Global Specialized Caches
const embeddingCache = new LruCache(1000, 1000 * 60 * 60 * 24); // 24 hours
const retrievalCache = new LruCache(300, 1000 * 60 * 30); // 30 minutes
const protocolCache = new LruCache(100, 1000 * 60 * 60 * 12); // 12 hours

module.exports = {
  LruCache,
  embeddingCache,
  retrievalCache,
  protocolCache,
};

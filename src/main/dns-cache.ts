import dns from 'node:dns';

import { LRUCache } from 'lru-cache';
import { LookupFunction } from 'net';

import { fetchMetrics } from './metrics.js';

export const dnsCache = new LRUCache<string, any>({
    max: 10_000,
    ttl: 120_000,
});

export const cachedDnsLookup: LookupFunction = (hostname, options, callback) => {
    const key = JSON.stringify({ hostname, options });
    const cached = dnsCache.get(key);
    if (cached) {
        fetchMetrics.dnsCache.hits.incr();
        callback(null, cached.address, cached.family);
        return;
    }
    fetchMetrics.dnsCache.misses.incr();
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
            callback(err, address, family);
            return;
        }
        dnsCache.set(key, { address, family });
        callback(null, address, family);
    });
};

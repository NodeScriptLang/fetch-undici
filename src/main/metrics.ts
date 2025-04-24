import { CounterMetric } from '@nodescript/metrics';

export const fetchMetrics = {
    requests: {
        total: new CounterMetric<{ host: string; proxyHost: string }>('fetch_requests_total', 'Total number of requests'),
        sent: new CounterMetric<{ status: number; host: string; proxyHost: string }>('fetch_requests_sent', 'Total number of requests sent'),
        failed: new CounterMetric<{ error: string; host: string; proxyHost: string }>('fetch_requests_failed', 'Total number of requests that failed'),
        timeout: new CounterMetric<{ host: string; proxyHost: string }>('fetch_requests_timeout', 'Total number of requests that timed out'),
    },
    dispatcherCache: {
        hits: new CounterMetric('fetch_dispatcher_cache_hits', 'Total number of dispatcher cache hits'),
        misses: new CounterMetric('fetch_dispatcher_cache_misses', 'Total number of dispatcher cache misses'),
    },
    dnsCache: {
        hits: new CounterMetric('fetch_dns_cache_hits', 'Total number of DNS cache hits'),
        misses: new CounterMetric('fetch_dns_cache_misses', 'Total number of DNS cache misses'),
    },
};

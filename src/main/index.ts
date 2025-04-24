import { FetchFunction, FetchRequestSpec } from '@nodescript/core/types';
import { FetchError } from '@nodescript/core/util';
import CacheableLookup from 'cacheable-lookup';
import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import { LookupFunction } from 'net';
import { Agent, Dispatcher, ProxyAgent, request } from 'undici';

const dnsLookupCache = new CacheableLookup({
    maxTtl: 120,
});
const dnsLookupFn = dnsLookupCache.lookup.bind(dnsLookupCache) as LookupFunction;

const dispatcherCache = new LRUCache<string, Dispatcher>({
    max: 1000,
});

export const DEFAULT_CONNECT_TIMEOUT = 30_000;
export const DEFAULT_BODY_TIMEOUT = 120_000;
export const DEFAULT_KEEP_ALIVE_TIMEOUT = 30_000;

export const defaultDispatcher = new Agent({
    connectTimeout: DEFAULT_CONNECT_TIMEOUT,
    bodyTimeout: DEFAULT_BODY_TIMEOUT,
    keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT,
    connect: {
        lookup: dnsLookupFn,
    },
});

export const fetchUndici: FetchFunction = async (req: FetchRequestSpec, body?: any) => {
    try {
        const {
            method,
            url,
            headers,
            connectOptions = {},
            followRedirects,
            proxy,
            timeout = DEFAULT_BODY_TIMEOUT,
        } = req;
        const dispatcher = getDispatcher({ proxy, connectOptions, timeout });
        const maxRedirections = followRedirects ? 10 : 0;
        const reqHeaders = filterHeaders({
            'user-agent': 'NodeScript / Fetch v1',
            ...headers
        });
        const signal = new EventEmitter();
        setTimeout(() => signal.emit('abort'), timeout).unref();
        const res = await request(url, {
            dispatcher,
            method,
            headers: reqHeaders,
            body,
            maxRedirections,
            signal,
        });
        return {
            status: res.statusCode,
            headers: filterHeaders(res.headers),
            body: res.body,
        };
    } catch (error: any) {
        if (error.code === 'UND_ERR_ABORTED') {
            throw new FetchError('Request timeout', 'ERR_TIMEOUT');
        }
        throw new FetchError(error.message, error.code);
    }
};

function getDispatcher(opts: {
    proxy?: string;
    timeout?: number;
    connectOptions?: Record<string, any>;
}) {
    const dispatcherKey = JSON.stringify({ proxy: opts.proxy, connectOptions: opts.connectOptions });
    const existing = dispatcherCache.get(dispatcherKey);
    if (existing) {
        return existing;
    }
    const dispatcher = createDispatcher(opts);
    dispatcherCache.set(dispatcherKey, dispatcher);
    return dispatcher;
}

function createDispatcher(opts: {
    proxy?: string;
    timeout?: number;
    connectOptions?: Record<string, any>;
}): Dispatcher {
    const connectOptions = opts.connectOptions ?? {};
    if (opts.proxy) {
        const proxyUrl = new URL(opts.proxy);
        const auth = (proxyUrl.username || proxyUrl.password) ? makeBasicAuth(proxyUrl.username, proxyUrl.password) : undefined;
        return new ProxyAgent({
            uri: opts.proxy,
            token: auth,
            connectTimeout: opts.timeout ?? DEFAULT_CONNECT_TIMEOUT,
            bodyTimeout: opts.timeout ?? DEFAULT_BODY_TIMEOUT,
            keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT,
            connect: {
                lookup: dnsLookupFn,
                ...connectOptions,
            },
        });
    }
    const hasConnectOptions = Object.keys(connectOptions).length > 0;
    const useCustomAgent = opts.timeout != null || hasConnectOptions;
    if (useCustomAgent) {
        return new Agent({
            connectTimeout: opts.timeout ?? DEFAULT_CONNECT_TIMEOUT,
            bodyTimeout: opts.timeout ?? DEFAULT_BODY_TIMEOUT,
            keepAliveTimeout: DEFAULT_KEEP_ALIVE_TIMEOUT,
            connect: {
                lookup: dnsLookupFn,
                ...connectOptions,
            },
        });
    }
    return defaultDispatcher;
}

function makeBasicAuth(username: string, password: string) {
    return `Basic ${Buffer.from(username + ':' + password).toString('base64')}`;
}

function filterHeaders(headers: Record<string, string | string[] | undefined>) {
    const result: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (v == null) {
            continue;
        }
        result[k.toLowerCase()] = v;
    }
    return result;
}

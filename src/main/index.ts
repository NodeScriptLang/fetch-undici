import { FetchFunction, FetchRequestSpec } from '@nodescript/core/types';
import { FetchError } from '@nodescript/core/util';
import EventEmitter from 'events';
import { Agent, Dispatcher, ProxyAgent, request } from 'undici';

export const DEFAULT_CONNECT_TIMEOUT = 30 * 1000;
export const DEFAULT_BODY_TIMEOUT = 120 * 1000;

export const defaultDispatcher = new Agent({
    bodyTimeout: DEFAULT_BODY_TIMEOUT,
    connect: {
        timeout: DEFAULT_CONNECT_TIMEOUT,
    }
});

export const fetchUndici: FetchFunction = async (req: FetchRequestSpec, body?: any) => {
    try {
        const {
            method,
            url,
            headers,
            proxy,
            followRedirects,
            timeout = 120_000,
            connectOptions = {},
        } = req;
        const dispatcher = getDispatcher({ proxy, connectOptions });
        const maxRedirections = followRedirects ? 10 : 0;
        const reqHeaders = filterHeaders({
            'user-agent': 'NodeScript / Fetch v1',
            ...headers
        });
        const abortSignal = new EventEmitter();
        setTimeout(() => abortSignal.emit('abort'), timeout).unref();
        const res = await request(url, {
            dispatcher,
            method,
            headers: reqHeaders,
            body,
            maxRedirections,
            signal: abortSignal,
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

function getDispatcher(opts: { proxy?: string; connectOptions: Record<string, any> }): Dispatcher {
    const connectOptions = opts.connectOptions ?? {};
    const {
        bodyTimeout = DEFAULT_BODY_TIMEOUT,
    } = connectOptions;
    if (opts.proxy) {
        const proxyUrl = new URL(opts.proxy);
        const auth = (proxyUrl.username || proxyUrl.password) ? makeBasicAuth(proxyUrl.username, proxyUrl.password) : undefined;
        return new ProxyAgent({
            uri: opts.proxy,
            token: auth,
            bodyTimeout,
            connect: {
                timeout: DEFAULT_CONNECT_TIMEOUT,
                ...connectOptions
            },
        });
    }
    if (Object.keys(connectOptions).length > 0) {
        return new Agent({
            bodyTimeout,
            connect: {
                timeout: DEFAULT_CONNECT_TIMEOUT,
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

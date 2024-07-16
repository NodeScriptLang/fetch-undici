import { FetchFunction, FetchRequestSpec } from '@nodescript/core/types';
import { FetchError } from '@nodescript/core/util';
import { Agent, Dispatcher, getGlobalDispatcher, ProxyAgent, request } from 'undici';

export const fetchUndici: FetchFunction = async (req: FetchRequestSpec, body?: any) => {
    try {
        const {
            method,
            url,
            headers,
            connectOptions,
            followRedirects,
            proxy,
        } = req;
        const dispatcher = getDispatcher({ proxy, connectOptions });
        const maxRedirections = followRedirects ? 10 : 0;
        const reqHeaders = filterHeaders({
            'user-agent': 'NodeScript / Fetch v1',
            ...headers
        });
        const res = await request(url, {
            dispatcher,
            method,
            headers: reqHeaders,
            body,
            maxRedirections,
        });
        return {
            status: res.statusCode,
            headers: filterHeaders(res.headers),
            body: res.body,
        };
    } catch (error: any) {
        throw new FetchError(error.message, error.code);
    }
};

function getDispatcher(opts: { proxy?: string; connectOptions: object }): Dispatcher {
    if (opts.proxy) {
        const proxyUrl = new URL(opts.proxy);
        const auth = (proxyUrl.username || proxyUrl.password) ? makeBasicAuth(proxyUrl.username, proxyUrl.password) : undefined;
        return new ProxyAgent({
            uri: opts.proxy,
            token: auth,
            connect: {
                ...opts.connectOptions
            },
        });
    }
    if (Object.keys(opts.connectOptions).length > 0) {
        return new Agent({
            connect: {
                ...opts.connectOptions,
            },
        });
    }
    return getGlobalDispatcher();
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

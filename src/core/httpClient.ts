import type { AppConfig } from "./config.js";
import type { DownstreamCallResult, RequestContext } from "./types.js";

export interface DownstreamRequestOptions {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  timeoutMs: number;
  context: RequestContext;
  headerNames: AppConfig["headerNames"];
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  logLabel?: string;
}

export async function callDownstreamService(options: DownstreamRequestOptions): Promise<DownstreamCallResult> {
  const url = appendQuery(options.url, options.query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const requestBody = options.body === undefined ? undefined : JSON.stringify(options.body);

  if (options.logLabel) {
    console.error(
      `[${options.logLabel}] 调用下游服务:`,
      JSON.stringify({
        url,
        method: options.method,
        headers: {
          "Content-Type": requestBody ? "application/json" : undefined,
          Accept: "application/json",
          [options.headerNames.tenant]: options.context.tenant,
          [options.headerNames.authorization]: "***",
          [options.headerNames.terminal]: options.context.terminal
        },
        body: options.body ?? null
      })
    );
  }

  try {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        Accept: "application/json",
        ...(requestBody
          ? {
              "Content-Type": "application/json",
              [options.headerNames.tenant]: options.context.tenant,
              [options.headerNames.authorization]: options.context.authorization,
              [options.headerNames.terminal]: options.context.terminal
            }
          : {
              [options.headerNames.tenant]: options.context.tenant,
              [options.headerNames.authorization]: options.context.authorization,
              [options.headerNames.terminal]: options.context.terminal
            })
      },
      body: requestBody,
      signal: controller.signal
    });

    const responseText = await response.text();
    const body = parseResponseBody(responseText, response.headers.get("content-type"));

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
      requestId: response.headers.get("x-request-id") ?? undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}

function appendQuery(
  url: string,
  query: Record<string, string | number | boolean | undefined | null> | undefined
): string {
  if (!query) {
    return url;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const serialized = searchParams.toString();
  if (!serialized) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${serialized}`;
}

function parseResponseBody(text: string, contentType: string | null): unknown {
  if (!text) {
    return null;
  }

  if (contentType?.toLowerCase().includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

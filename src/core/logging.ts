import type { AlarmProcessToolArgs } from "../modules/alarm/types.js";

const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie", "set-cookie"]);

export function logHttpRequestEntry(
  method: string,
  path: string,
  headers: Record<string, string | string[] | undefined>,
  body: unknown
): void {
  console.error("[mcp-entry] HTTP 请求入口");
  console.error(
    JSON.stringify(
      {
        method,
        path,
        rawHeaders: serializeRawHeaders(headers),
        body
      },
      null,
      2
    )
  );
}

export function logAlarmProcessEntry(options: {
  rawRequestHeaders?: Record<string, string | string[] | undefined>;
  args: AlarmProcessToolArgs;
}): void {
  console.error("[alarm_process] 工具调用入口");
  console.error(
    JSON.stringify(
      {
        rawHeaders: options.rawRequestHeaders ? serializeRawHeaders(options.rawRequestHeaders) : {},
        parameters: serializeAlarmProcessArgs(options.args)
      },
      null,
      2
    )
  );
}

export function serializeRawHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    result[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? maskHeaderValue(value) : value;
  }

  return result;
}

function serializeAlarmProcessArgs(args: AlarmProcessToolArgs): Record<string, unknown> {
  return {
    ids: args.ids,
    alarmConfirmedResult: args.alarmConfirmedResult,
    alarmConfirmedResultRemark: args.alarmConfirmedResultRemark ?? null,
    requestContext: args.requestContext
      ? {
          tenant: args.requestContext.tenant ?? null,
          authorization: args.requestContext.authorization
            ? maskSingleValue(args.requestContext.authorization)
            : null,
          terminal: args.requestContext.terminal ?? null
        }
      : null
  };
}

function maskHeaderValue(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(maskSingleValue) : maskSingleValue(value);
}

function maskSingleValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return "***";
  }

  return `${trimmed.slice(0, 6)}***`;
}

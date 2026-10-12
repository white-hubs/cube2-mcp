import type { AppConfig } from "../../core/config.js";
import { callDownstreamService } from "../../core/httpClient.js";
import type { RequestContext } from "../../core/types.js";

const RISK_CONTROL_API_PREFIX = "/risk-control";

export interface RiskControlRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  logLabel?: string;
}

export async function callRiskControlService(
  config: AppConfig,
  context: RequestContext,
  options: RiskControlRequestOptions
) {
  if (!config.riskControl) {
    throw new Error("Risk-control module is not enabled.");
  }

  const normalizedPath = options.path.startsWith("/") ? options.path : `${RISK_CONTROL_API_PREFIX}/${options.path}`;
  const url = `${config.riskControl.serviceUrl}${normalizedPath}`;

  return callDownstreamService({
    url,
    method: options.method,
    timeoutMs: config.riskControl.timeoutMs,
    context,
    headerNames: config.headerNames,
    query: options.query,
    body: options.body,
    logLabel: options.logLabel
  });
}

export function riskPath(template: string, params: Record<string, string | undefined>): string {
  return Object.entries(params).reduce((path, [key, value]) => {
    if (!value) {
      return path;
    }

    return path.replace(`{${key}}`, encodeURIComponent(value));
  }, template);
}

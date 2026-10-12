import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import type { AppConfig } from "./config.js";
import { resolveRequestContext } from "./context.js";
import type { PartialRequestContext } from "./types.js";

export interface ToolRuntime {
  config: AppConfig;
  transportContext?: PartialRequestContext;
  rawRequestHeaders?: Record<string, string | string[] | undefined>;
}

export const requestContextSchema = z
  .object({
    tenant: z.string().min(1).optional().describe("仅调试/stdio 兜底使用。生产 HTTP transport 应通过 MCP 请求头动态传入。"),
    authorization: z.string().min(1).optional().describe("仅调试/stdio 兜底使用。生产 HTTP transport 应通过 MCP 请求头动态传入。"),
    terminal: z.string().min(1).optional().describe("仅调试/stdio 兜底使用。生产 HTTP transport 应通过 MCP 请求头动态传入。")
  })
  .optional()
  .describe("仅在 stdio、本地调试或调用方无法动态设置 MCP HTTP headers 时使用。");

export const snowflakeIdSchema = z
  .string()
  .min(1, "ID 不能为空")
  .describe("雪花 ID，必须传 string。禁止传 number，避免 JavaScript 精度丢失。");

export const optionalSnowflakeIdSchema = z
  .string()
  .min(1)
  .optional()
  .describe("可选雪花 ID，传值时必须为 string。");

export const snowflakeIdArraySchema = z
  .array(snowflakeIdSchema)
  .describe("雪花 ID 字符串数组，禁止 number[]。");

export function resolveToolContext(
  runtime: ToolRuntime,
  toolContext?: PartialRequestContext
): { context?: import("./types.js").RequestContext; missing: string[] } {
  const resolved = resolveRequestContext({
    config: runtime.config,
    transportContext: runtime.transportContext,
    toolContext
  });

  return {
    context: resolved.context,
    missing: resolved.missing
  };
}

export function missingContextResult(missing: string[]): CallToolResult {
  return toolError(
    `缺少调用下游业务服务所需动态上下文: ${missing.join(", ")}。请由 MCP client 在 HTTP 请求头中动态注入 tenant、authorization、terminal，或配置 MCP_CONTEXT_* 环境变量兜底。`,
    {
      ok: false,
      missingContext: missing
    }
  );
}

export function downstreamResult(result: import("./types.js").DownstreamCallResult, successMessage: string): CallToolResult {
  const structuredContent = {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    requestId: result.requestId,
    downstreamResult: result.body
  };

  if (!result.ok) {
    return toolError(`下游业务服务返回失败，HTTP ${result.status} ${result.statusText}`.trim(), structuredContent);
  }

  return {
    content: [{ type: "text", text: successMessage }],
    structuredContent
  };
}

export function jsonToolResult(value: unknown, message?: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: message ?? JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value as Record<string, unknown>
  };
}

export function toolError(message: string, structuredContent: Record<string, unknown>): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent
  };
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? "请求超时" : error.message;
  }

  return String(error);
}

export function buildContextParameterSpec(config: AppConfig) {
  return {
    preferredDelivery: "dynamic MCP Streamable HTTP request headers",
    reason:
      "tenant、authorization、terminal 属于每次调用的上下文/鉴权信息，应由 MCP client 或网关按当前用户/租户动态写入 MCP HTTP 请求头。",
    headers: [
      {
        name: config.headerNames.tenant,
        required: true,
        forwardedAs: config.headerNames.tenant,
        dynamicSource: "当前登录用户或当前会话所属租户",
        description: "租户标识。"
      },
      {
        name: config.headerNames.authorization,
        required: true,
        forwardedAs: config.headerNames.authorization,
        dynamicSource: "当前用户访问业务系统的 token，或网关换取的服务端 token",
        description: "认证信息，例如 Bearer token。"
      },
      {
        name: config.headerNames.terminal,
        required: true,
        forwardedAs: config.headerNames.terminal,
        dynamicSource: "调用来源，例如 agent、web、mobile",
        description: "终端/来源标识。"
      }
    ],
    stdioFallback: {
      field: "requestContext",
      envVars: ["MCP_CONTEXT_TENANT", "MCP_CONTEXT_AUTHORIZATION", "MCP_CONTEXT_TERMINAL"]
    }
  };
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import { buildAlarmProcessParameterSpec, buildAlarmToolCatalogEntry } from "./parameters.js";
import { callAlarmService } from "./service.js";
import type { ToolRuntime } from "../../core/toolRuntime.js";
import {
  downstreamResult,
  jsonToolResult,
  missingContextResult,
  requestContextSchema,
  resolveToolContext,
  toErrorMessage,
  toolError
} from "../../core/toolRuntime.js";
import { logAlarmProcessEntry } from "../../core/logging.js";
import { ALARM_HANDLER_RESULTS, type AlarmProcessPayload, type AlarmProcessToolArgs } from "./types.js";

const alarmRecordIdSchema = z
  .string()
  .min(1, "报警记录主键不能为空")
  .describe("报警记录主键（雪花 ID，必须 string，禁止 number）");

export function registerAlarmTools(server: McpServer, runtime: ToolRuntime): void {
  if (!runtime.config.alarm) {
    return;
  }

  server.registerTool(
    "alarm_process",
    {
      title: "报警处理",
      description:
        "处理报警记录并调用下游报警服务批量确认。适用于用户要实报/误报确认、批量消警的场景。ids 必须传 string[] 雪花 ID，建议每批最多 10 个。tenant/authorization/terminal 通过 MCP HTTP 请求头注入，不要写进业务参数。调用前建议先读 get_alarm_process_parameters。",
      inputSchema: {
        ids: z
          .array(alarmRecordIdSchema)
          .min(1)
          .max(10, "批量处理建议每次最多 10 个 ID")
          .describe("报警记录主键列表，必须 string[]。"),
        alarmConfirmedResult: z.enum(ALARM_HANDLER_RESULTS).describe("ALARM_ACTUAL=实报，ALARM_IMPRACTICAL=误报。"),
        alarmConfirmedResultRemark: z.string().max(200).optional().describe("报警确认描述，最多 200 字。"),
        requestContext: requestContextSchema
      }
    },
    async (args: AlarmProcessToolArgs): Promise<CallToolResult> => {
      logAlarmProcessEntry({ rawRequestHeaders: runtime.rawRequestHeaders, args });

      const resolved = resolveToolContext(runtime, args.requestContext);
      if (!resolved.context) {
        return missingContextResult(resolved.missing);
      }

      const payload: AlarmProcessPayload = {
        ids: args.ids,
        alarmConfirmedResult: args.alarmConfirmedResult,
        alarmConfirmedResultRemark: args.alarmConfirmedResultRemark
      };

      try {
        const result = await callAlarmService(runtime.config, payload, resolved.context);
        return downstreamResult(result, `报警处理已提交，下游 HTTP 状态码: ${result.status}`);
      } catch (error) {
        return toolError(`调用下游报警服务失败: ${toErrorMessage(error)}`, { ok: false });
      }
    }
  );

  server.registerTool(
    "get_alarm_process_parameters",
    {
      title: "获取报警处理参数",
      description:
        "返回 alarm_process 的参数说明、批量限制和上下文注入方式。当模型不确定是否该调用 alarm_process，或不清楚 ids/确认结果格式时，必须先调用本工具。",
      inputSchema: {}
    },
    async (): Promise<CallToolResult> => {
      const spec = buildAlarmProcessParameterSpec(runtime.config);
      return jsonToolResult(spec, JSON.stringify(spec, null, 2));
    }
  );
}

export function getAlarmCatalogEntries(): import("../../core/types.js").ToolCatalogEntry[] {
  return [buildAlarmToolCatalogEntry()];
}

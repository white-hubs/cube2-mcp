import type { AppConfig } from "../../core/config.js";
import { buildContextParameterSpec } from "../../core/toolRuntime.js";

export function buildAlarmProcessParameterSpec(config: AppConfig) {
  return {
    toolName: "alarm_process",
    title: "报警处理",
    module: "alarm",
    whenToUse: "用户要确认、批量处理、实报/误报报警记录时调用。",
    description: "调用下游 HTTP 报警服务，对一个或多个报警记录做批量确认处理。",
    batchProcessing: {
      recommendedBatchSize: 10,
      description: "批量处理接口，建议每批最多 10 个 ID，上一批完成后再处理下一批。"
    },
    downstreamApi: {
      method: "PUT",
      contentType: "application/json",
      urlEnv: "ALARM_SERVICE_URL",
      bodyFields: ["ids", "alarmConfirmedResult", "alarmConfirmedResultRemark"],
      contextHeaders: ["tenant", "authorization", "terminal"]
    },
    agentGuidance: [
      "调用 alarm_process 前，先调用 list_mcp_tools 或 get_alarm_process_parameters 确认参数格式。",
      "ids 是雪花 ID，必须使用 string[] 传入。",
      "禁止将 ids 传为 number 或 number[]。",
      "建议每批最多 10 个 ID。"
    ],
    businessParameters: [
      {
        name: "ids",
        type: "string[]",
        required: true,
        description: "报警记录主键列表（雪花 ID）。"
      },
      {
        name: "alarmConfirmedResult",
        type: "enum",
        required: true,
        enumValues: [
          { value: "ALARM_ACTUAL", description: "实报" },
          { value: "ALARM_IMPRACTICAL", description: "误报" }
        ]
      },
      {
        name: "alarmConfirmedResultRemark",
        type: "string",
        required: false,
        constraints: ["最大 200 个字符"]
      }
    ],
    contextParameters: buildContextParameterSpec(config)
  };
}

export function buildAlarmToolCatalogEntry(): import("../../core/types.js").ToolCatalogEntry {
  return {
    toolName: "alarm_process",
    title: "报警处理",
    module: "alarm",
    whenToUse: "用户要确认报警、批量实报/误报处理、消警时调用。",
    relatedScenarios: ["报警确认", "批量报警处理"],
    prerequisites: ["list_mcp_tools", "get_alarm_process_parameters"],
    downstream: {
      method: "PUT",
      path: "ALARM_SERVICE_URL"
    }
  };
}

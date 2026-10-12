import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { AppConfig } from "./config.js";
import { jsonToolResult } from "./toolRuntime.js";
import type { PartialRequestContext, ToolCatalogEntry } from "./types.js";
import { getAlarmCatalogEntries, registerAlarmTools } from "../modules/alarm/tools.js";
import { RISK_CONTROL_TOOL_CATALOG, registerRiskControlTools } from "../modules/risk-control/index.js";
import type { ToolRuntime } from "./toolRuntime.js";

export function createMcpServer(options: {
  config: AppConfig;
  transportContext?: PartialRequestContext;
  rawRequestHeaders?: Record<string, string | string[] | undefined>;
}): McpServer {
  const runtime: ToolRuntime = {
    config: options.config,
    transportContext: options.transportContext,
    rawRequestHeaders: options.rawRequestHeaders
  };

  const server = new McpServer({
    name: options.config.serverName,
    version: options.config.serverVersion
  });

  registerCatalogTools(server, runtime);
  registerAlarmTools(server, runtime);
  registerRiskControlTools(server, runtime);

  return server;
}

function registerCatalogTools(server: McpServer, runtime: ToolRuntime): void {
  server.registerTool(
    "list_mcp_tools",
    {
      title: "列出 MCP 工具箱",
      description:
        "返回当前已启用模块的全部 MCP 写入工具清单。本服务不负责查询数据；查询与对话引导由技能/业务 API 承担。",
      inputSchema: {}
    },
    async (): Promise<CallToolResult> => {
      const tools = collectToolCatalog(runtime.config);
      const payload = {
        serverName: runtime.config.serverName,
        enabledModules: runtime.config.enabledModules,
        guidance: [
          "本 MCP 仅用于业务数据写入/提交，不提供查询详情或列表能力。",
          "对话引导、态势查询、辨识推荐等由 AI 技能或业务查询 API 完成。",
          "先阅读 list_mcp_tools，再读 get_alarm_process_parameters 或 get_risk_control_tool_parameters。",
          "所有雪花 ID 必须传 string，禁止 number。"
        ],
        tools
      };

      return jsonToolResult(payload, JSON.stringify(payload, null, 2));
    }
  );
}

function collectToolCatalog(config: AppConfig): ToolCatalogEntry[] {
  const entries: ToolCatalogEntry[] = [
    {
      toolName: "list_mcp_tools",
      title: "列出 MCP 工具箱",
      module: "core",
      whenToUse: "进入任何业务对话后，模型应首先调用本工具了解可用能力。",
      relatedScenarios: ["全部场景"]
    }
  ];

  if (config.alarm) {
    entries.push(...getAlarmCatalogEntries());
    entries.push({
      toolName: "get_alarm_process_parameters",
      title: "获取报警处理参数",
      module: "alarm",
      whenToUse: "准备调用 alarm_process 前读取参数说明。",
      relatedScenarios: ["报警处理"],
      prerequisites: ["list_mcp_tools"]
    });
  }

  if (config.riskControl) {
    entries.push(...RISK_CONTROL_TOOL_CATALOG);
  }

  return entries;
}

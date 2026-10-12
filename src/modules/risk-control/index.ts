import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ToolRuntime } from "../../core/toolRuntime.js";
import { registerRiskControlWriteTools } from "./writeTools.js";

export function registerRiskControlTools(server: McpServer, runtime: ToolRuntime): void {
  registerRiskControlWriteTools(server, runtime);
}

export { RISK_CONTROL_TOOL_CATALOG, buildRiskControlParameterSpec } from "./catalog.js";

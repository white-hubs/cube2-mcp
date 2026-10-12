import type { AppConfig } from "../../core/config.js";
import { buildContextParameterSpec } from "../../core/toolRuntime.js";
import type { ToolCatalogEntry } from "../../core/types.js";

/** 仅包含写入/提交类操作，不含任何查询接口。查询与对话引导由技能/业务 API 承担。 */
export const RISK_CONTROL_TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    toolName: "risk_submit_identification",
    title: "提交风险辨识对象",
    module: "risk-control",
    whenToUse: "辨识对话已由技能完成，用户确认后需要把新增/修改/删除的风险对象写入系统时调用。不是辨识引导本身。",
    relatedScenarios: ["场景1 风险辨识引导-提交落库"],
    prerequisites: ["get_risk_control_tool_parameters"],
    downstream: { method: "POST", path: "/risk-control/units/{unitId}/identifications" }
  },
  {
    toolName: "risk_create_reviews",
    title: "创建辨识审核结论",
    module: "risk-control",
    whenToUse: "审核人员确认通过或退回单个/批量风险对象，需要写入审核结论时调用。",
    relatedScenarios: ["场景2 辨识审核辅助"],
    downstream: { method: "POST", path: "/risk-control/reviews" }
  },
  {
    toolName: "risk_create_assessment",
    title: "创建/提交风险评估",
    module: "risk-control",
    whenToUse: "评估打分对话已由技能完成，需要保存草稿或提交 LEC 等评估结果时调用。methodId/objectId 由技能上下文提供。",
    relatedScenarios: ["场景3 风险评估打分"],
    downstream: { method: "POST", path: "/risk-control/assessments" }
  },
  {
    toolName: "risk_save_control_measures",
    title: "保存/提交管控措施",
    module: "risk-control",
    whenToUse: "措施推荐对话已由技能完成，用户确认方案后需要保存或提交进入执行时调用。",
    relatedScenarios: ["场景4 管控措施推荐-保存"],
    downstream: { method: "PUT", path: "/risk-control/risk-objects/{objectId}/control-measures" }
  },
  {
    toolName: "risk_submit_measure_execution",
    title: "提交措施执行反馈",
    module: "risk-control",
    whenToUse: "执行人确认措施已完成/部分完成/未完成，需要写入执行记录时调用。",
    relatedScenarios: ["场景5 措施执行催办-反馈落库"],
    downstream: { method: "POST", path: "/risk-control/control-measures/{measureId}/execution-records" }
  },
  {
    toolName: "risk_generate_review_report",
    title: "生成评审报告",
    module: "risk-control",
    whenToUse: "用户确认要生成某时间范围的风险管控评审报告并落库时调用。合规项在返回体 complianceItems 中。",
    relatedScenarios: ["场景9 合规诊断", "场景10 评审报告生成"],
    downstream: { method: "POST", path: "/risk-control/review-reports" }
  },
  {
    toolName: "get_risk_control_tool_parameters",
    title: "获取风险管控写入工具参数说明",
    module: "risk-control",
    whenToUse: "准备调用 risk_* 写入工具前，确认参数格式、枚举值和 ID 规则时调用。",
    relatedScenarios: ["全部风险管控写入场景"],
    prerequisites: ["list_mcp_tools"]
  }
];

export function buildRiskControlParameterSpec(config: AppConfig) {
  return {
    module: "risk-control",
    title: "风险管控 MCP 写入工具说明",
    purpose:
      "本 MCP 仅封装风险管控的数据写入/提交操作。查询详情、列表、态势、辨识引导对话、措施推荐对话等由 AI 技能或业务查询 API 完成，不应调用本 MCP。",
    serviceUrlEnv: "RISK_CONTROL_SERVICE_URL",
    gatewayPathPrefix: "/securitymanagement",
    apiPathPrefix: "/risk-control",
    agentGuidance: [
      "先调用 list_mcp_tools，再调用 get_risk_control_tool_parameters。",
      "不要把“风险辨识引导”“管控措施推荐”“四色图查询”等对话能力当作 MCP 工具；那些是技能层职责。",
      "MCP 只在用户/技能已经拿到完整业务参数、需要落库或提交时调用。",
      "所有雪花 ID（unitId/objectId/methodId/measureId 等）必须传 string，禁止 number 和 number[]。",
      "tenant、authorization、terminal 通过 MCP HTTP 请求头注入。",
      "风险对象新增/修改/删除只能通过 risk_submit_identification 批量提交。",
      "reviewResult: APPROVED | REJECTED；assessmentType: INHERENT | CONTROL。"
    ],
    tools: RISK_CONTROL_TOOL_CATALOG,
    commonEnums: {
      reviewResult: ["APPROVED", "REJECTED"],
      assessmentType: ["INHERENT", "CONTROL"],
      executionResult: ["COMPLETED", "EXECUTING", "PARTIAL", "PENDING", "NOT_EXECUTED"]
    },
    contextParameters: buildContextParameterSpec(config)
  };
}

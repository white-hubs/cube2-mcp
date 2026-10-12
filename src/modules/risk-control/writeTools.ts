import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import type { ToolRuntime } from "../../core/toolRuntime.js";
import {
  downstreamResult,
  jsonToolResult,
  missingContextResult,
  optionalSnowflakeIdSchema,
  requestContextSchema,
  resolveToolContext,
  snowflakeIdArraySchema,
  snowflakeIdSchema,
  toErrorMessage,
  toolError
} from "../../core/toolRuntime.js";
import { buildRiskControlParameterSpec } from "./catalog.js";
import { callRiskControlService, riskPath } from "./service.js";

const identificationObjectSchema = z.object({
  objectId: optionalSnowflakeIdSchema.describe("为空表示新增；有值表示修改或删除。"),
  code: z.string().optional(),
  name: z.string().optional().describe("风险对象名称。"),
  assetId: optionalSnowflakeIdSchema,
  responsibleUserId: z.string().optional(),
  hazardDesc: z.string().optional().describe("危险源/风险描述。"),
  accidentTypes: z.string().optional().describe("事故类型编码，多个按后端约定拼接。"),
  accidentCause: z.string().optional().describe("事故原因。"),
  triggerFactor: z.string().optional().describe("触发因素。"),
  emergencyMeasure: z.string().optional().describe("应急处置措施。"),
  deleted: z.boolean().optional().describe("true 表示删除该对象。"),
  userId: z.string().optional().describe("辨识人员用户 ID。")
});

const controlMeasureSchema = z.object({
  measureId: optionalSnowflakeIdSchema,
  measureType: z.string().optional().describe("措施类型：工程技术/管理/培训教育/个体防护/应急处置等。"),
  content: z.string().optional().describe("措施内容。"),
  executionLevel: z.string().optional().describe("执行层级：公司级/部门级/班组级/岗位级。"),
  executorUserId: z.string().optional().describe("执行人用户 ID。"),
  deadlineDays: z.number().int().positive().optional().describe("执行时限（天）。"),
  deleted: z.boolean().optional()
});

async function runRiskWrite(
  runtime: ToolRuntime,
  requestContext: unknown,
  options: Parameters<typeof callRiskControlService>[2],
  successMessage: string
): Promise<CallToolResult> {
  const resolved = resolveToolContext(runtime, requestContext as never);
  if (!resolved.context) {
    return missingContextResult(resolved.missing);
  }

  try {
    const result = await callRiskControlService(runtime.config, resolved.context, options);
    return downstreamResult(result, successMessage);
  } catch (error) {
    return toolError(`调用风险管控服务失败: ${toErrorMessage(error)}`, { ok: false });
  }
}

export function registerRiskControlWriteTools(server: McpServer, runtime: ToolRuntime): void {
  if (!runtime.config.riskControl) {
    return;
  }

  server.registerTool(
    "risk_submit_identification",
    {
      title: "提交风险辨识对象",
      description:
        "【写入】向指定单元提交风险对象集合（新增/修改/删除）。辨识引导对话属于技能，不在本 MCP；仅在用户确认后落库时调用。unitId/objectId 必须为 string 雪花 ID。",
      inputSchema: {
        unitId: snowflakeIdSchema.describe("风险单元 ID（string）。"),
        objects: z.array(identificationObjectSchema).min(1).describe("本次提交的对象集合。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "POST",
          path: riskPath("/risk-control/units/{unitId}/identifications", { unitId: args.unitId }),
          body: { objects: args.objects },
          logLabel: "risk_submit_identification"
        },
        "已提交风险辨识对象。"
      )
  );

  server.registerTool(
    "risk_create_reviews",
    {
      title: "创建辨识审核结论",
      description: "【写入】单条或批量审核通过/退回风险对象。objectId/objectIds 必须为 string。reviewResult=REJECTED 时 rejectReason 必填。",
      inputSchema: {
        objectId: optionalSnowflakeIdSchema.describe("单条审核时使用（string）。"),
        objectIds: snowflakeIdArraySchema.optional().describe("批量审核时使用（string[]）。"),
        reviewResult: z.enum(["APPROVED", "REJECTED"]).describe("APPROVED=通过，REJECTED=退回。"),
        rejectReason: z.string().optional().describe("退回原因，reviewResult=REJECTED 时必填。"),
        reviewComment: z.string().optional().describe("审核意见。"),
        userId: z.string().optional().describe("审核人用户 ID。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "POST",
          path: "/risk-control/reviews",
          body: {
            objectId: args.objectId,
            objectIds: args.objectIds,
            reviewResult: args.reviewResult,
            rejectReason: args.rejectReason,
            reviewComment: args.reviewComment,
            userId: args.userId
          },
          logLabel: "risk_create_reviews"
        },
        "已创建辨识审核记录。"
      )
  );

  server.registerTool(
    "risk_create_assessment",
    {
      title: "创建/提交风险评估",
      description:
        "【写入】保存或提交固有/控制评估结果。评估引导与 methodId 获取属于技能；此处只负责落库。objectId/methodId/id 必须为 string。",
      inputSchema: {
        objectId: snowflakeIdSchema.describe("风险对象 ID（string）。"),
        assessmentType: z.enum(["INHERENT", "CONTROL"]).describe("INHERENT=固有评估，CONTROL=控制评估。"),
        methodId: optionalSnowflakeIdSchema.describe("评估方法 ID（string），固有评估必填。"),
        dimensionScores: z
          .record(z.string(), z.number())
          .optional()
          .describe("维度得分，如 { L: 3, E: 2, C: 7 }。"),
        submitted: z.boolean().optional().describe("false=草稿，true=提交。"),
        id: optionalSnowflakeIdSchema.describe("已有草稿记录 ID（string）。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "POST",
          path: "/risk-control/assessments",
          body: {
            id: args.id,
            objectId: args.objectId,
            assessmentType: args.assessmentType,
            methodId: args.methodId,
            dimensionScores: args.dimensionScores,
            submitted: args.submitted
          },
          logLabel: "risk_create_assessment"
        },
        "已创建风险评估记录。"
      )
  );

  server.registerTool(
    "risk_save_control_measures",
    {
      title: "保存/提交管控措施",
      description: "【写入】保存或提交某风险对象的管控措施。措施推荐对话属于技能；用户确认方案后调用本工具落库。objectId/measureId 必须为 string。",
      inputSchema: {
        objectId: snowflakeIdSchema,
        measures: z.array(controlMeasureSchema).min(1).describe("措施列表。"),
        submitted: z.boolean().optional().describe("false=草稿，true=提交执行。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "PUT",
          path: riskPath("/risk-control/risk-objects/{objectId}/control-measures", { objectId: args.objectId }),
          body: {
            measures: args.measures,
            submitted: args.submitted
          },
          logLabel: "risk_save_control_measures"
        },
        "已保存管控措施。"
      )
  );

  server.registerTool(
    "risk_submit_measure_execution",
    {
      title: "提交措施执行反馈",
      description: "【写入】执行人反馈措施完成情况并落库。measureId 必须为 string。",
      inputSchema: {
        measureId: snowflakeIdSchema.describe("管控措施 ID（string）。"),
        executionResult: z
          .enum(["COMPLETED", "EXECUTING", "PARTIAL", "PENDING", "NOT_EXECUTED"])
          .describe("执行结果。"),
        executionDesc: z.string().optional().describe("执行说明。"),
        executorUserId: z.string().optional(),
        fileIds: z.array(z.string()).max(9).optional().describe("附件文件 ID，最多 9 个。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "POST",
          path: riskPath("/risk-control/control-measures/{measureId}/execution-records", {
            measureId: args.measureId
          }),
          body: {
            executionResult: args.executionResult,
            executionDesc: args.executionDesc,
            executorUserId: args.executorUserId,
            fileIds: args.fileIds
          },
          logLabel: "risk_submit_measure_execution"
        },
        "已提交措施执行反馈。"
      )
  );

  server.registerTool(
    "risk_generate_review_report",
    {
      title: "生成评审报告",
      description: "【写入】按时间范围生成并落库风险管控评审报告。合规诊断结论在返回 complianceItems 中。areaId 必须为 string。",
      inputSchema: {
        reportName: z.string().optional().describe("报告名称。"),
        periodType: z.string().optional().describe("周期类型，如 QUARTER/YEAR。"),
        startDate: z.string().optional().describe("开始日期，格式 YYYY-MM-DD。"),
        endDate: z.string().optional().describe("结束日期，格式 YYYY-MM-DD。"),
        scopeType: z.string().optional().describe("范围类型，如 ALL/AREA。"),
        areaId: optionalSnowflakeIdSchema.describe("scopeType=AREA 时使用（string）。"),
        requestContext: requestContextSchema
      }
    },
    async args =>
      runRiskWrite(
        runtime,
        args.requestContext,
        {
          method: "POST",
          path: "/risk-control/review-reports",
          body: {
            reportName: args.reportName,
            periodType: args.periodType,
            startDate: args.startDate,
            endDate: args.endDate,
            scopeType: args.scopeType,
            areaId: args.areaId
          },
          logLabel: "risk_generate_review_report"
        },
        "已生成评审报告。"
      )
  );

  server.registerTool(
    "get_risk_control_tool_parameters",
    {
      title: "获取风险管控写入工具参数说明",
      description:
        "返回 risk_* 写入工具的用途、枚举值和雪花 ID 规则。本 MCP 不含查询工具；模型不确定是否该写入落库时，先调用本工具。",
      inputSchema: {}
    },
    async (): Promise<CallToolResult> => {
      const spec = buildRiskControlParameterSpec(runtime.config);
      return jsonToolResult(spec, JSON.stringify(spec, null, 2));
    }
  );
}

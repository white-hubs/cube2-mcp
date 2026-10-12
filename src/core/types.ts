export type McpModuleName = "alarm" | "risk-control" | "core";

export interface RequestContext {
  tenant: string;
  authorization: string;
  terminal: string;
}

export type PartialRequestContext = Partial<RequestContext>;

export interface RequestContextFieldSpec {
  name: string;
  required: boolean;
  forwardedAs: string;
  dynamicSource: string;
  description: string;
}

export interface DownstreamCallResult {
  ok: boolean;
  status: number;
  statusText: string;
  body: unknown;
  requestId?: string;
}

export interface ToolCatalogEntry {
  toolName: string;
  title: string;
  module: McpModuleName;
  whenToUse: string;
  relatedScenarios: string[];
  prerequisites?: string[];
  downstream?: {
    method: string;
    path: string;
  };
}

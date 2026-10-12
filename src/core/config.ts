import type { McpModuleName, PartialRequestContext } from "./types.js";

export type McpTransportMode = "http" | "stdio";

export interface AlarmModuleConfig {
  serviceUrl: string;
  timeoutMs: number;
}

export interface RiskControlModuleConfig {
  serviceUrl: string;
  timeoutMs: number;
}

export interface AppConfig {
  serverName: string;
  serverVersion: string;
  enabledModules: McpModuleName[];
  alarm?: AlarmModuleConfig;
  riskControl?: RiskControlModuleConfig;
  transport: McpTransportMode;
  http: {
    host: string;
    port: number;
    path: string;
  };
  headerNames: {
    tenant: string;
    authorization: string;
    terminal: string;
  };
  staticContext: PartialRequestContext;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv.slice(2)
): AppConfig {
  const transport = parseTransport(readArg(argv, "--transport") ?? env.MCP_TRANSPORT ?? "http");
  const enabledModules = resolveEnabledModules(env);
  const alarm = enabledModules.includes("alarm") ? loadAlarmModuleConfig(env) : undefined;
  const riskControl = enabledModules.includes("risk-control") ? loadRiskControlModuleConfig(env) : undefined;

  return {
    serverName: env.MCP_SERVER_NAME ?? "cube2-mcp",
    serverVersion: env.MCP_SERVER_VERSION ?? "0.2.0",
    enabledModules,
    alarm,
    riskControl,
    transport,
    http: {
      host: env.MCP_HOST ?? "127.0.0.1",
      port: parsePositiveInt(env.MCP_PORT, 3000, "MCP_PORT"),
      path: normalizePath(env.MCP_PATH ?? "/mcp")
    },
    headerNames: {
      tenant: env.MCP_HEADER_TENANT ?? "tenant",
      authorization: env.MCP_HEADER_AUTHORIZATION ?? "authorization",
      terminal: env.MCP_HEADER_TERMINAL ?? "terminal"
    },
    staticContext: {
      tenant: blankToUndefined(env.MCP_CONTEXT_TENANT),
      authorization: blankToUndefined(env.MCP_CONTEXT_AUTHORIZATION),
      terminal: blankToUndefined(env.MCP_CONTEXT_TERMINAL)
    }
  };
}

function resolveEnabledModules(env: NodeJS.ProcessEnv): McpModuleName[] {
  const configured = blankToUndefined(env.MCP_MODULES);
  if (configured) {
    const modules = configured
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => parseModuleName(item));

    if (modules.length === 0) {
      throw new Error("MCP_MODULES must include at least one module: alarm, risk-control.");
    }

    return [...new Set(modules)];
  }

  const autoEnabled: McpModuleName[] = [];
  if (blankToUndefined(env.ALARM_SERVICE_URL)) {
    autoEnabled.push("alarm");
  }
  if (blankToUndefined(env.RISK_CONTROL_SERVICE_URL)) {
    autoEnabled.push("risk-control");
  }

  if (autoEnabled.length === 0) {
    throw new Error(
      "No MCP modules enabled. Set MCP_MODULES=alarm,risk-control or configure ALARM_SERVICE_URL / RISK_CONTROL_SERVICE_URL."
    );
  }

  return autoEnabled;
}

function parseModuleName(value: string): McpModuleName {
  if (value === "alarm" || value === "risk-control") {
    return value;
  }

  throw new Error(`Invalid MCP module: ${value}. Expected "alarm" or "risk-control".`);
}

function loadAlarmModuleConfig(env: NodeJS.ProcessEnv): AlarmModuleConfig {
  return {
    serviceUrl: requiredUrl(env.ALARM_SERVICE_URL, "ALARM_SERVICE_URL"),
    timeoutMs: parsePositiveInt(env.ALARM_SERVICE_TIMEOUT_MS, 10_000, "ALARM_SERVICE_TIMEOUT_MS")
  };
}

function loadRiskControlModuleConfig(env: NodeJS.ProcessEnv): RiskControlModuleConfig {
  return {
    serviceUrl: requiredBaseUrl(env.RISK_CONTROL_SERVICE_URL, "RISK_CONTROL_SERVICE_URL"),
    timeoutMs: parsePositiveInt(env.RISK_CONTROL_SERVICE_TIMEOUT_MS, 15_000, "RISK_CONTROL_SERVICE_TIMEOUT_MS")
  };
}

function readArg(argv: string[], name: string): string | undefined {
  const inline = argv.find(arg => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }

  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseTransport(value: string): McpTransportMode {
  if (value === "http" || value === "stdio") {
    return value;
  }

  throw new Error(`Invalid MCP_TRANSPORT: ${value}. Expected "http" or "stdio".`);
}

function requiredUrl(value: string | undefined, name: string): string {
  const normalized = blankToUndefined(value);
  if (!normalized) {
    throw new Error(`${name} is required when the alarm module is enabled.`);
  }

  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
}

function requiredBaseUrl(value: string | undefined, name: string): string {
  const normalized = requiredUrl(value, name);
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function parsePositiveInt(value: string | undefined, defaultValue: number, name: string): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

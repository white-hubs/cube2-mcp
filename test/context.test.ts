import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/core/config.js";
import { extractContextFromHeaders, resolveRequestContext } from "../src/core/context.js";

function alarmOnlyConfig() {
  return loadConfig({
    MCP_MODULES: "alarm",
    ALARM_SERVICE_URL: "https://example.com/alarm/handle"
  } as NodeJS.ProcessEnv);
}

describe("context", () => {
  it("extracts context from MCP HTTP request headers", () => {
    const req = {
      headers: {
        tenant: "tenant-a",
        authorization: "Bearer token",
        terminal: "agent"
      }
    };

    expect(extractContextFromHeaders(req as never, alarmOnlyConfig())).toEqual({
      tenant: "tenant-a",
      authorization: "Bearer token",
      terminal: "agent"
    });
  });

  it("lets transport headers override tool and static fallback context", () => {
    const appConfig = loadConfig({
      MCP_MODULES: "alarm",
      ALARM_SERVICE_URL: "https://example.com/alarm/handle",
      MCP_CONTEXT_TENANT: "static-tenant",
      MCP_CONTEXT_AUTHORIZATION: "Bearer static",
      MCP_CONTEXT_TERMINAL: "static-terminal"
    } as NodeJS.ProcessEnv);

    const result = resolveRequestContext({
      config: appConfig,
      toolContext: {
        tenant: "tool-tenant",
        authorization: "Bearer tool",
        terminal: "tool-terminal"
      },
      transportContext: {
        authorization: "Bearer header"
      }
    });

    expect(result).toEqual({
      missing: [],
      context: {
        tenant: "tool-tenant",
        authorization: "Bearer header",
        terminal: "tool-terminal"
      }
    });
  });

  it("falls back to env context when transport headers are absent", () => {
    const appConfig = loadConfig({
      MCP_MODULES: "alarm",
      ALARM_SERVICE_URL: "https://example.com/alarm/handle",
      MCP_CONTEXT_TENANT: "static-tenant",
      MCP_CONTEXT_AUTHORIZATION: "Bearer static",
      MCP_CONTEXT_TERMINAL: "static-terminal"
    } as NodeJS.ProcessEnv);

    expect(
      resolveRequestContext({
        config: appConfig,
        transportContext: {
          tenant: undefined,
          authorization: undefined,
          terminal: undefined
        }
      })
    ).toEqual({
      missing: [],
      context: {
        tenant: "static-tenant",
        authorization: "Bearer static",
        terminal: "static-terminal"
      }
    });
  });

  it("reports missing context keys", () => {
    expect(
      resolveRequestContext({
        config: alarmOnlyConfig(),
        toolContext: {
          tenant: "tenant-a"
        }
      })
    ).toEqual({
      missing: ["authorization", "terminal"]
    });
  });
});

describe("loadConfig modules", () => {
  it("auto-enables modules from service urls", () => {
    const config = loadConfig({
      ALARM_SERVICE_URL: "https://example.com/alarm/handle",
      RISK_CONTROL_SERVICE_URL: "https://example.com/securitymanagement"
    } as NodeJS.ProcessEnv);

    expect(config.enabledModules).toEqual(["alarm", "risk-control"]);
    expect(config.alarm?.serviceUrl).toBe("https://example.com/alarm/handle");
    expect(config.riskControl?.serviceUrl).toBe("https://example.com/securitymanagement");
  });
});

import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { loadConfig } from "./core/config.js";
import { extractContextFromHeaders } from "./core/context.js";
import { logHttpRequestEntry } from "./core/logging.js";
import { createMcpServer } from "./core/server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  logStartupContext(config);

  if (config.transport === "stdio") {
    await startStdio(config);
    return;
  }

  await startHttp(config);
}

async function startStdio(config: ReturnType<typeof loadConfig>): Promise<void> {
  const server = createMcpServer({ config });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.serverName} is running over stdio (modules: ${config.enabledModules.join(", ")})`);
}

async function startHttp(config: ReturnType<typeof loadConfig>): Promise<void> {
  const app = createMcpExpressApp({ host: config.http.host });

  app.post(config.http.path, async (req: Request, res: Response) => {
    logHttpRequestEntry(req.method, req.path, req.headers, req.body);

    const server = createMcpServer({
      config,
      transportContext: extractContextFromHeaders(req, config),
      rawRequestHeaders: req.headers
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  });

  app.get(config.http.path, methodNotAllowed);
  app.delete(config.http.path, methodNotAllowed);

  const httpServer = app.listen(config.http.port, config.http.host, () => {
    console.error(
      `${config.serverName} is running at http://${config.http.host}:${config.http.port}${config.http.path} (modules: ${config.enabledModules.join(", ")})`
    );
  });

  httpServer.on("error", error => {
    console.error(`Failed to start ${config.serverName}:`, error);
    process.exit(1);
  });
}

function methodNotAllowed(_req: Request, res: Response): void {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  });
}

function logStartupContext(config: ReturnType<typeof loadConfig>): void {
  const { staticContext } = config;
  const loaded = (["tenant", "authorization", "terminal"] as const).filter(key => Boolean(staticContext[key]?.trim()));

  console.error(
    `[${config.serverName}] 启动配置:`,
    JSON.stringify({
      enabledModules: config.enabledModules,
      alarmServiceConfigured: Boolean(config.alarm),
      riskControlServiceConfigured: Boolean(config.riskControl),
      contextFallbackLoaded: loaded,
      contextFallbackMissing: ["tenant", "authorization", "terminal"].filter(
        key => !staticContext[key as keyof typeof staticContext]?.trim()
      ),
      tenant: staticContext.tenant ?? null,
      terminal: staticContext.terminal ?? null,
      authorization: staticContext.authorization ? "***" : null
    })
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

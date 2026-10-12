# cube2-mcp

通用 Cube 业务 MCP 桥接服务。按模块聚合多个业务的**写入/提交**能力，避免每个业务单独建仓库。

历史仓库名曾为 `alarm-mcp` / `cube-mcp`，现统一为 `cube2-mcp`。

## 定位

本服务只做数据写入/提交，不做查询。列表、详情、四色图、辨识引导对话、措施推荐等由 **AI 技能 + 业务查询 API** 完成。

通过 `MCP_MODULES` 按需启用模块；未配置时，会根据是否设置对应 `*_SERVICE_URL` 自动推断。

## 内置模块

### alarm

报警批量处理。

| 工具 | 说明 |
|------|------|
| `alarm_process` | 批量确认实报/误报，调用下游报警服务 |
| `get_alarm_process_parameters` | 返回 `alarm_process` 参数与上下文传递说明 |

### risk-control

风险分级管控**写入**工具。辨识引导、措施推荐等对话不在本 MCP 内。

| 工具 | 说明 |
|------|------|
| `risk_submit_identification` | 提交风险辨识对象 |
| `risk_create_reviews` | 创建辨识审核结论 |
| `risk_create_assessment` | 创建/提交风险评估 |
| `risk_save_control_measures` | 保存/提交管控措施 |
| `risk_submit_measure_execution` | 提交措施执行反馈 |
| `risk_generate_review_report` | 生成评审报告 |
| `get_risk_control_tool_parameters` | 返回 risk_* 写入工具参数说明 |

### 通用工具

| 工具 | 说明 |
|------|------|
| `list_mcp_tools` | 列出当前启用模块下的写入工具及使用指引 |

## Agent 接入建议

1. 先调用 `list_mcp_tools`，确认当前启用了哪些写入工具
2. 报警落库前读 `get_alarm_process_parameters`
3. 风险管控落库前读 `get_risk_control_tool_parameters`
4. 所有雪花 ID 必须传 **string**，禁止 number
5. `tenant` / `authorization` / `terminal` 走请求头或环境变量，不要让模型“编写”鉴权信息

## 推荐的上下文传递方案

`tenant`、`authorization`、`terminal` 不是业务字段，而是调用下游业务系统时的上下文/鉴权信息。成熟做法是：

1. 生产或远程部署优先使用 MCP Streamable HTTP transport。
2. MCP client 或网关在每次访问 `/mcp` 时动态附带请求头：`tenant`、`authorization`、`terminal`。
3. MCP 服务从请求头取这些值，并原样转发给下游 HTTP 服务。
4. agent 只负责传业务参数。

不要把下面这些值写死在 MCP 配置文件里（仅适合本地单租户调试）：

```json
{
  "headers": {
    "tenant": "tenant-a",
    "authorization": "Bearer fixed-token",
    "terminal": "agent"
  }
}
```

stdio 或本地固定部署可用环境变量兜底：

- `MCP_CONTEXT_TENANT`
- `MCP_CONTEXT_AUTHORIZATION`
- `MCP_CONTEXT_TERMINAL`

工具参数里的 `requestContext` 可用，但不如 HTTP header / 网关注入干净。

## 配置

复制 `.env.example` 到部署环境。按启用模块配置对应服务地址：

```bash
MCP_MODULES=alarm,risk-control

# alarm 模块
ALARM_SERVICE_URL=https://alarm-service.example.com/api/alarm/handle

# risk-control 模块
RISK_CONTROL_SERVICE_URL=https://gateway.example.com/securitymanagement
```

通用可选配置：

```bash
MCP_TRANSPORT=http
MCP_HOST=127.0.0.1
MCP_PORT=3000
MCP_PATH=/mcp
MCP_SERVER_NAME=cube2-mcp
MCP_HEADER_TENANT=tenant
MCP_HEADER_AUTHORIZATION=authorization
MCP_HEADER_TERMINAL=terminal
ALARM_SERVICE_TIMEOUT_MS=10000
RISK_CONTROL_SERVICE_TIMEOUT_MS=15000
```

## 开发运行

```bash
npm install
npm run dev:http
```

stdio 模式：

```bash
npm run dev:stdio
```

构建和测试：

```bash
npm run build
npm test
```

## Docker 镜像（aarch64）

与 `prod/cube-services/fetch-service` 相同：**SSH 拉取远程仓库 → Bun 构建单文件 bundle → Node slim 运行**。运行时通过环境变量配置，不要把 `.env` 打进镜像。

```bash
# 在含 id_rsa 的构建目录执行（与 fetch-service 一致）
# 构建上下文目录需放置：id_rsa、Dockerfile.aarch64
docker build -f Dockerfile.aarch64 \
  --build-arg BRANCH=main \
  -t cube2-mcp:latest .

docker run --rm -p 3000:3000 \
  -e MCP_MODULES=alarm,risk-control \
  -e ALARM_SERVICE_URL=http://192.168.0.243:3200/alarm/alarm-records/batch-handler \
  -e RISK_CONTROL_SERVICE_URL=http://192.168.0.243:3200/securitymanagement \
  -e ALARM_SERVICE_TIMEOUT_MS=10000 \
  -e MCP_CONTEXT_TENANT=58197260 \
  -e MCP_CONTEXT_AUTHORIZATION='Bearer <your-token>' \
  -e MCP_CONTEXT_TERMINAL=bimops-manage-web \
  cube2-mcp:latest
```

远程仓库：`git@git.guhecloud.com:ghcloud/ai/cube2-mcp.git`，通过 `BRANCH` 指定构建分支。

本地可先打包验证：

```bash
bun run build:node
bun run start:node
```

| 变量 | 说明 | 默认 |
|------|------|------|
| `MCP_MODULES` | 启用模块：`alarm`、`risk-control` | 按 URL 自动推断 |
| `ALARM_SERVICE_URL` | 报警下游批量处理接口（PUT + JSON） | 启用 alarm 时必填 |
| `RISK_CONTROL_SERVICE_URL` | 风险管控网关基址（如 `.../securitymanagement`） | 启用 risk-control 时必填 |
| `ALARM_SERVICE_TIMEOUT_MS` | 报警下游超时（毫秒） | `10000` |
| `RISK_CONTROL_SERVICE_TIMEOUT_MS` | 风险管控下游超时（毫秒） | `15000` |
| `MCP_TRANSPORT` | `http` 或 `stdio` | `http` |
| `MCP_HOST` | MCP 监听地址 | 容器内默认 `0.0.0.0` |
| `MCP_PORT` | MCP 端口 | `3000` |
| `MCP_PATH` | MCP HTTP 路径 | `/mcp` |
| `MCP_HEADER_TENANT` | 转发给下游的 tenant 请求头字段名 | `tenant` |
| `MCP_HEADER_AUTHORIZATION` | 转发给下游的 authorization 请求头字段名 | `authorization` |
| `MCP_HEADER_TERMINAL` | 转发给下游的 terminal 请求头字段名 | `terminal` |
| `MCP_CONTEXT_TENANT` | 无 MCP 请求头时的 tenant 兜底 | 可选 |
| `MCP_CONTEXT_AUTHORIZATION` | 无 MCP 请求头时的 authorization 兜底 | 可选 |
| `MCP_CONTEXT_TERMINAL` | 无 MCP 请求头时的 terminal 兜底 | 可选 |

## MCP client 动态传参方式

如果自行实现 MCP client，可在创建 Streamable HTTP transport 时按当前用户动态设置 headers：

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function createCube2McpClient(session: {
  tenant: string;
  accessToken: string;
  terminal: string;
}) {
  const client = new Client({
    name: "your-agent",
    version: "1.0.0"
  });

  const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3000/mcp"), {
    requestInit: {
      headers: {
        tenant: session.tenant,
        authorization: `Bearer ${session.accessToken}`,
        terminal: session.terminal
      }
    }
  });

  await client.connect(transport);
  return client;
}
```

如果现成 agent 平台的 MCP 配置只能写固定 URL，建议加一层 MCP gateway：

```text
agent 平台 -> MCP gateway -> cube2-mcp
```

gateway 做三件事：

1. 从当前会话、cookie、JWT 或业务登录态拿到 `tenant`、`authorization`、`terminal`。
2. 转发 MCP JSON-RPC 请求到 `http://cube2-mcp:3000/mcp`。
3. 在转发请求时动态补齐 headers。

伪代码：

```ts
app.post("/mcp", async (req, res) => {
  const session = await getCurrentSession(req);

  const response = await fetch("http://cube2-mcp:3000/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: req.header("accept") ?? "application/json, text/event-stream",
      tenant: session.tenant,
      authorization: `Bearer ${session.accessToken}`,
      terminal: "agent"
    },
    body: JSON.stringify(req.body)
  });

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.text());
});
```

stdio 模式只能用环境变量或 `requestContext` 兜底，不适合多用户动态鉴权：

```json
{
  "mcpServers": {
    "cube2-mcp": {
      "command": "node",
      "args": ["/Users/ghy/work/cube2-mcp/dist/cube2-mcp.mjs", "--transport", "stdio"],
      "env": {
        "MCP_MODULES": "alarm,risk-control",
        "ALARM_SERVICE_URL": "https://alarm-service.example.com/api/alarm/handle",
        "RISK_CONTROL_SERVICE_URL": "https://gateway.example.com/securitymanagement",
        "MCP_CONTEXT_TENANT": "local-debug-tenant",
        "MCP_CONTEXT_AUTHORIZATION": "Bearer <local-debug-token>",
        "MCP_CONTEXT_TERMINAL": "agent"
      }
    }
  }
}
```

## 模块参数示例

### `alarm_process`

```json
{
  "ids": ["1234567890123456789", "9876543210987654321"],
  "alarmConfirmedResult": "ALARM_ACTUAL",
  "alarmConfirmedResultRemark": "现场核实为真实报警"
}
```

`alarmConfirmedResult` 可选值：

- `ALARM_ACTUAL`：实报
- `ALARM_IMPRACTICAL`：误报

stdio 或本地调试兜底传上下文示例：

```json
{
  "ids": ["1234567890123456789"],
  "alarmConfirmedResult": "ALARM_IMPRACTICAL",
  "alarmConfirmedResultRemark": "设备抖动导致误报",
  "requestContext": {
    "tenant": "local-debug-tenant",
    "authorization": "Bearer <local-debug-token>",
    "terminal": "agent"
  }
}
```

### risk-control 写入工具

调用前请先读 `get_risk_control_tool_parameters`，按其返回的参数格式、枚举与 ID 规则传参。所有雪花 ID（`unitId` / `objectId` / `methodId` / `measureId` 等）必须传 string。

生产环境不要让 `authorization` 进入工具参数，优先通过 HTTP headers 动态注入。

import { afterEach, describe, expect, it, vi } from "vitest";

import { callAlarmService } from "../src/modules/alarm/service.js";
import { loadConfig } from "../src/core/config.js";

afterEach(async () => {
  vi.restoreAllMocks();
});

describe("callAlarmService", () => {
  it("forwards alarm payload and context headers to downstream service", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-1"
        }
      })
    );

    const result = await callAlarmService(
      loadConfig({
        MCP_MODULES: "alarm",
        ALARM_SERVICE_URL: "https://example.com/alarm/handle"
      } as NodeJS.ProcessEnv),
      {
        ids: ["1", "2"],
        alarmConfirmedResult: "ALARM_ACTUAL",
        alarmConfirmedResultRemark: "confirmed"
      },
      {
        tenant: "tenant-a",
        authorization: "Bearer token",
        terminal: "agent"
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/alarm/handle");
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json",
      tenant: "tenant-a",
      authorization: "Bearer token",
      terminal: "agent"
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      ids: ["1", "2"],
      alarmConfirmedResult: "ALARM_ACTUAL",
      alarmConfirmedResultRemark: "confirmed"
    });
    expect(result).toEqual({
      ok: true,
      status: 200,
      statusText: "OK",
      body: { success: true },
      requestId: "req-1"
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { logAlarmProcessEntry, logHttpRequestEntry, serializeRawHeaders } from "../src/core/logging.js";

describe("logging", () => {
  it("serializes raw headers and masks authorization", () => {
    expect(
      serializeRawHeaders({
        tenant: "tenant-a",
        authorization: "Bearer secret-token",
        terminal: "agent"
      })
    ).toEqual({
      tenant: "tenant-a",
      authorization: "Bearer***",
      terminal: "agent"
    });
  });

  it("logs http request entry with raw headers and body", () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logHttpRequestEntry(
      "POST",
      "/mcp",
      {
        tenant: "tenant-a",
        authorization: "Bearer secret-token"
      },
      {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "alarm_process",
          arguments: {
            ids: ["123"]
          }
        }
      }
    );

    expect(logSpy).toHaveBeenCalledTimes(2);
    const payload = logSpy.mock.calls[1][0] as string;
    expect(payload).toContain('"rawHeaders"');
    expect(payload).toContain('"tenant": "tenant-a"');
    expect(payload).toContain('"authorization": "Bearer***"');
    expect(payload).toContain('"123"');

    logSpy.mockRestore();
  });

  it("logs alarm_process entry with raw headers and parameters", () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logAlarmProcessEntry({
      rawRequestHeaders: {
        tenant: "tenant-a",
        authorization: "Bearer secret-token",
        terminal: "agent"
      },
      args: {
        ids: ["1234567890123456789"],
        alarmConfirmedResult: "ALARM_ACTUAL",
        alarmConfirmedResultRemark: "confirmed"
      }
    });

    expect(logSpy).toHaveBeenCalledTimes(2);
    const payload = logSpy.mock.calls[1][0] as string;
    expect(payload).toContain('"rawHeaders"');
    expect(payload).toContain('"parameters"');
    expect(payload).toContain('"1234567890123456789"');

    logSpy.mockRestore();
  });
});

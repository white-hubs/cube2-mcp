import type { AppConfig } from "../../core/config.js";
import { callDownstreamService } from "../../core/httpClient.js";
import type { RequestContext } from "../../core/types.js";
import type { AlarmProcessPayload } from "./types.js";

export async function callAlarmService(
  config: AppConfig,
  payload: AlarmProcessPayload,
  context: RequestContext
) {
  if (!config.alarm) {
    throw new Error("Alarm module is not enabled.");
  }

  return callDownstreamService({
    url: config.alarm.serviceUrl,
    method: "PUT",
    timeoutMs: config.alarm.timeoutMs,
    context,
    headerNames: config.headerNames,
    body: payload,
    logLabel: "alarm_process"
  });
}

export const ALARM_HANDLER_RESULTS = ["ALARM_ACTUAL", "ALARM_IMPRACTICAL"] as const;

export type AlarmHandlerResult = (typeof ALARM_HANDLER_RESULTS)[number];

export interface AlarmProcessPayload {
  ids: string[];
  alarmConfirmedResult: AlarmHandlerResult;
  alarmConfirmedResultRemark?: string;
}

export interface AlarmProcessToolArgs extends AlarmProcessPayload {
  requestContext?: import("../../core/types.js").PartialRequestContext;
}

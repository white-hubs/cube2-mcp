import type { Request } from "express";

import type { AppConfig } from "./config.js";
import type { PartialRequestContext, RequestContext } from "./types.js";

export function extractContextFromHeaders(req: Request, config: AppConfig): PartialRequestContext {
  return {
    tenant: readHeader(req, config.headerNames.tenant, "tenant", "x-tenant"),
    authorization: readHeader(req, config.headerNames.authorization, "authorization"),
    terminal: readHeader(req, config.headerNames.terminal, "terminal", "x-terminal")
  };
}

export function resolveRequestContext(options: {
  config: AppConfig;
  transportContext?: PartialRequestContext;
  toolContext?: PartialRequestContext;
}): { context?: RequestContext; missing: Array<keyof RequestContext> } {
  const merged = mergeDefinedContext(
    options.config.staticContext,
    options.toolContext,
    options.transportContext
  );

  const missing = (["tenant", "authorization", "terminal"] as Array<keyof RequestContext>).filter(key => {
    const value = merged[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missing.length > 0) {
    return { missing };
  }

  return {
    context: {
      tenant: merged.tenant!.trim(),
      authorization: merged.authorization!.trim(),
      terminal: merged.terminal!.trim()
    },
    missing
  };
}

function mergeDefinedContext(...sources: Array<PartialRequestContext | undefined>): PartialRequestContext {
  const merged: PartialRequestContext = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of ["tenant", "authorization", "terminal"] as const) {
      const value = normalizeContextValue(source[key]);
      if (value) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function normalizeContextValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readHeader(req: Request, ...names: string[]): string | undefined {
  for (const name of uniqueHeaderNames(names)) {
    const value = req.headers[name.toLowerCase()];
    const normalized = normalizeHeaderValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function uniqueHeaderNames(names: string[]): string[] {
  return [...new Set(names.map(name => name.toLowerCase()))];
}

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue?.trim();
  return normalized ? normalized : undefined;
}

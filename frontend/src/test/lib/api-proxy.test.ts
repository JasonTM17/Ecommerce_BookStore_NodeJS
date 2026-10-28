import { describe, expect, it } from "vitest";
import {
  isCacheablePublicProxyGet,
  normalizeProxyTarget,
  resolveProxyTargets,
  resolveProxyTarget,
  shouldFallbackProxyResponseStatus,
} from "@/lib/server/api-proxy";

describe("api proxy target resolution", () => {
  it("prefers Render internal hostport when available", () => {
    expect(
      resolveProxyTarget({
        BACKEND_HOSTPORT: "bookstore-api-abcd:10000",
        API_PROXY_TARGET: "https://bookstore-api.onrender.com/api",
      }),
    ).toBe("http://bookstore-api-abcd:10000/api");
  });

  it("returns internal and public targets in fallback order when both are available", () => {
    expect(
      resolveProxyTargets({
        BACKEND_HOSTPORT: "bookstore-api-abcd:10000",
        API_PROXY_TARGET: "https://bookstore-api-a1xl.onrender.com/api",
      }),
    ).toEqual([
      "http://bookstore-api-abcd:10000/api",
      "https://bookstore-api-a1xl.onrender.com/api",
    ]);
  });

  it("falls back to explicit public proxy target", () => {
    expect(
      resolveProxyTarget({
        API_PROXY_TARGET: "https://bookstore-api-a1xl.onrender.com/api",
      }),
    ).toBe("https://bookstore-api-a1xl.onrender.com/api");
  });

  it("keeps the Node.js fork on its local backend when no target is configured", () => {
    expect(resolveProxyTarget({})).toBe(
      "http://127.0.0.1:8080/api",
    );
  });

  it("does not silently add an upstream production fallback to the Node.js backend", () => {
    expect(resolveProxyTargets({ BACKEND_HOSTPORT: "backend-node:8080" })).toEqual([
      "http://backend-node:8080/api",
    ]);
  });

  it("normalizes missing api suffix", () => {
    expect(
      normalizeProxyTarget("https://bookstore-api-a1xl.onrender.com"),
    ).toBe("https://bookstore-api-a1xl.onrender.com/api");
  });

  it("falls back only for transient proxy response statuses", () => {
    expect(shouldFallbackProxyResponseStatus(429)).toBe(true);
    expect(shouldFallbackProxyResponseStatus(502)).toBe(true);
    expect(shouldFallbackProxyResponseStatus(503)).toBe(true);
    expect(shouldFallbackProxyResponseStatus(504)).toBe(true);
    expect(shouldFallbackProxyResponseStatus(404)).toBe(false);
    expect(shouldFallbackProxyResponseStatus(500)).toBe(false);
  });

  it("only caches safe public GET proxy routes", () => {
    expect(isCacheablePublicProxyGet("GET", ["products"])).toBe(true);
    expect(isCacheablePublicProxyGet("GET", ["flash-sales", "active"])).toBe(
      true,
    );
    expect(isCacheablePublicProxyGet("GET", ["admin", "products"])).toBe(false);
    expect(isCacheablePublicProxyGet("POST", ["products"])).toBe(false);
  });
});

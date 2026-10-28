const FALLBACK_PROXY_TARGET = "http://127.0.0.1:8080/api";
const FALLBACK_PROXY_STATUSES = new Set([429, 502, 503, 504]);
const PUBLIC_CACHEABLE_GET_PREFIXES = [
  "brands",
  "categories",
  "coupons/available",
  "flash-sales",
  "products",
  "reviews",
];

export function normalizeProxyTarget(rawTarget?: string) {
  const target = (rawTarget || FALLBACK_PROXY_TARGET)
    .trim()
    .replace(/\/+$/, "");
  return target.endsWith("/api") ? target : `${target}/api`;
}

export function resolveProxyTargets(
  env:
    | NodeJS.ProcessEnv
    | { BACKEND_HOSTPORT?: string; API_PROXY_TARGET?: string },
) {
  const targets: string[] = [];
  const internalHostport = env.BACKEND_HOSTPORT?.trim();

  if (internalHostport) {
    targets.push(normalizeProxyTarget(`http://${internalHostport}`));
  }

  const publicTarget = env.API_PROXY_TARGET?.trim();
  if (publicTarget) {
    const normalizedPublicTarget = normalizeProxyTarget(publicTarget);
    if (!targets.includes(normalizedPublicTarget)) {
      targets.push(normalizedPublicTarget);
    }
  }

  if (targets.length === 0) {
    targets.push(normalizeProxyTarget(undefined));
  }

  return targets;
}

export function resolveProxyTarget(
  env:
    | NodeJS.ProcessEnv
    | { BACKEND_HOSTPORT?: string; API_PROXY_TARGET?: string },
) {
  return resolveProxyTargets(env)[0];
}

export function shouldFallbackProxyResponseStatus(status: number) {
  return FALLBACK_PROXY_STATUSES.has(status);
}

export function isCacheablePublicProxyGet(
  method: string,
  pathSegments: string[],
) {
  if (method.toUpperCase() !== "GET") {
    return false;
  }

  const joinedPath = pathSegments.join("/");
  return PUBLIC_CACHEABLE_GET_PREFIXES.some(
    (prefix) => joinedPath === prefix || joinedPath.startsWith(`${prefix}/`),
  );
}

import {
  handleBatch,
  handleHealth,
  handleHls,
  handleLanding,
  handlePlayer,
  handleOpenApi,
  handleResolve,
  handleSegment,
  handleStream,
  type RequestContext,
} from "./handlers";
import { Budget } from "./lib/budget";
import { ApiError, ErrorCode } from "./lib/errors";
import { CORS_HEADERS, clientIp, errorResponse, newRequestId, withHeaders } from "./lib/http";
import { log } from "./lib/log";
import { checkRateLimit, rateLimitHeaders } from "./lib/ratelimit";
import type { Env } from "./types";

/** Endpoints that stay open even when API_KEY is configured. */
const PUBLIC_PATHS = new Set(["/", "/health", "/openapi.json", "/favicon.ico", "/player"]);

/** Endpoints that hit TeraBox, and are therefore rate limited. */
const METERED_PATHS = new Set(["/api/resolve", "/api/batch", "/stream", "/hls", "/segment"]);

/**
 * Personal-use mode: API_KEY is no longer required by clients.
 * TeraBox endpoints remain rate-limited by client IP below.
 */

function route(ctx: RequestContext): Promise<Response> | Response | null {
  const { request, url } = ctx;
  const { pathname } = url;
  const method = request.method;

  // v1 compatibility: `GET /?link=` and `POST /` resolved a share before the
  // /api/* routes existed. Both still work; a bare `GET /` is the docs page.
  if (pathname === "/") {
    if (method === "POST") return handleResolve(ctx);
    if (method === "GET") {
      return url.searchParams.has("link") || url.searchParams.has("url")
        ? handleResolve(ctx)
        : handleLanding(ctx);
    }
    return null;
  }

  if (pathname === "/player" && method === "GET") return handlePlayer(ctx);

  if (pathname === "/api/resolve" && (method === "GET" || method === "POST")) {
    return handleResolve(ctx);
  }
  if (pathname === "/api/batch" && method === "POST") return handleBatch(ctx);
  if (pathname === "/stream" && (method === "GET" || method === "HEAD")) return handleStream(ctx);
  if (pathname === "/hls" && method === "GET") return handleHls(ctx);
  if (pathname === "/segment" && (method === "GET" || method === "HEAD")) return handleSegment(ctx);
  if (pathname === "/health" && method === "GET") return handleHealth(ctx);
  if (pathname === "/openapi.json" && method === "GET") return handleOpenApi(ctx);
  if (pathname === "/favicon.ico") return new Response(null, { status: 204 });

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = newRequestId();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const started = Date.now();
    const ctx: RequestContext = { request, env, url, requestId, budget: new Budget() };
    let extraHeaders: Record<string, string> = {};

    try {
      const metered =
        METERED_PATHS.has(url.pathname) ||
        (url.pathname === "/" && !isLandingRequest(request, url));

      if (metered) {
        const limit = checkRateLimit(env, clientIp(request));
        extraHeaders = rateLimitHeaders(limit);
        if (!limit.allowed) throw ApiError.rateLimited(limit.retryAfter);
      }

      const routed = route(ctx);
      if (routed === null) {
        throw new ApiError(
          ErrorCode.NOT_FOUND,
          `No route for ${request.method} ${url.pathname}. See ${url.origin}/openapi.json.`,
          404,
        );
      }

      const response = await routed;
      log("info", "request complete", {
        request_id: requestId,
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration_ms: Date.now() - started,
        budget_used: ctx.budget.used,
      });

      return withHeaders(response, { ...CORS_HEADERS, ...extraHeaders, "X-Request-Id": requestId });
    } catch (err) {
      if (err instanceof ApiError) {
        log("warn", "request failed", {
          request_id: requestId,
          method: request.method,
          path: url.pathname,
          code: err.code,
          status: err.status,
          duration_ms: Date.now() - started,
        });
      } else {
        // Unexpected errors are logged in full but never echoed to the caller,
        // since their messages can leak internals.
        log("error", "unhandled error", {
          request_id: requestId,
          method: request.method,
          path: url.pathname,
          error: err instanceof Error ? err.stack : String(err),
        });
      }

      return withHeaders(errorResponse(err, requestId), { ...CORS_HEADERS, ...extraHeaders });
    }
  },
} satisfies ExportedHandler<Env>;

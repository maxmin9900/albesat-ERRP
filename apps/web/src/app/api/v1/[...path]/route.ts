import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = (process.env.API_INTERNAL_URL || "http://localhost:8010").replace(/\/$/, "");

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function buildUpstreamUrl(path: string[], search: string): string {
  const suffix = path.length ? path.join("/") : "";
  return `${API_ORIGIN}/api/v1/${suffix}${search}`;
}

function rewriteSetCookieForHttp(cookie: string, isHttps: boolean): string {
  if (isHttps) return cookie;
  return cookie
    .replace(/;\s*Secure\b/gi, "")
    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax");
}

function requestIsHttps(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

async function proxyRequest(req: NextRequest, path: string[]): Promise<NextResponse> {
  const upstreamUrl = buildUpstreamUrl(path, req.nextUrl.search);
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      {
        error: "network_error",
        message:
          "Cannot reach the API. Start the backend: docker compose -f docker-compose.yml -f docker-compose.dockerdb.yml up -d",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    responseHeaders.set(key, value);
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  const isHttps = requestIsHttps(req);
  for (const cookie of setCookies) {
    responseHeaders.append("Set-Cookie", rewriteSetCookieForHttp(cookie, isHttps));
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(req, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;

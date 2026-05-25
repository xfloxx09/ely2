import { NextRequest, NextResponse } from "next/server";
import { handleApiRequest } from "@ely/server/router";

function toApiPath(pathSegments: string[] | undefined): string {
  if (!pathSegments?.length) return "/health";
  return `/${pathSegments.join("/")}`;
}

async function dispatch(req: NextRequest, pathSegments: string[]) {
  const path = toApiPath(pathSegments);
  const search = req.nextUrl.search;
  const fullPath = search ? `${path}${search}` : path;

  let body: unknown;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  const { status, body: responseBody } = await handleApiRequest({
    method: req.method,
    path: fullPath,
    body,
    authHeader: req.headers.get("authorization"),
  });

  return NextResponse.json(responseBody, { status });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path || []);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path || []);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path || []);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  return dispatch(req, path || []);
}

/**
 * Qoder Sessions API Proxy
 *
 * 代理转发到 QoderClaw 后端，避免前端直接调用跨域 API
 */

import { NextResponse } from "next/server";

// QoderClaw 后端地址（从环境变量读取，支持自定义部署）
const QODERCLAW_BASE_URL =
  process.env.QODERCLAW_INTERNAL_URL || "http://localhost:8080";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const targetUrl = `${QODERCLAW_BASE_URL}/api/qoder-sessions${
      searchParams ? `?${searchParams}` : ""
    }`;

    console.log("[QoderProxy] Forwarding GET request to:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[QoderProxy] Backend returned error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch from QoderClaw", status: response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log(
      "[QoderProxy] Successfully fetched sessions:",
      data.sessions?.length || 0,
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[QoderProxy] Error forwarding request:", error);
    return NextResponse.json(
      { error: "Internal proxy error", message: String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split("/").pop();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 },
      );
    }

    const targetUrl = `${QODERCLAW_BASE_URL}/api/qoder-sessions/${encodeURIComponent(
      sessionId,
    )}`;

    console.log("[QoderProxy] Forwarding DELETE request to:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "DELETE",
    });

    if (!response.ok) {
      console.error("[QoderProxy] Backend returned error:", response.status);
      return NextResponse.json(
        { error: "Failed to delete session", status: response.status },
        { status: response.status },
      );
    }

    console.log("[QoderProxy] Successfully deleted session:", sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QoderProxy] Error forwarding request:", error);
    return NextResponse.json(
      { error: "Internal proxy error", message: String(error) },
      { status: 500 },
    );
  }
}

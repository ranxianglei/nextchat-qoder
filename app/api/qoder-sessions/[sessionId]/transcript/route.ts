/**
 * Qoder Session Transcript API Proxy
 *
 * 代理转发到 QoderClaw 后端获取会话转录
 */

import { NextResponse } from "next/server";

// QoderClaw 后端地址
const QODERCLAW_BASE_URL =
  process.env.QODERCLAW_INTERNAL_URL || "http://localhost:8080";

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const sessionId = params.sessionId;

    const targetUrl = `${QODERCLAW_BASE_URL}/api/qoder-sessions/${encodeURIComponent(
      sessionId,
    )}/transcript${searchParams ? `?${searchParams}` : ""}`;

    console.log("[QoderProxy] Forwarding transcript request to:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[QoderProxy] Backend returned error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch transcript", status: response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log(
      "[QoderProxy] Successfully fetched transcript:",
      data.messages?.length || 0,
      "messages",
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

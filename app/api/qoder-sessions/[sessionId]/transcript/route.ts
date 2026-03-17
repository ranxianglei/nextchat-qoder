/**
 * Qoder Session Transcript API Proxy
 *
 * 代理转发到 QoderClaw 后端获取会话转录
 */

import { NextResponse } from "next/server";

// QoderClaw 后端地址
const QODERCLAW_BASE_URL =
  process.env.QODERCLAW_INTERNAL_URL || "http://localhost:8080";

// QoderClaw API Key（从环境变量读取，用于后端鉴权）
const QODERCLAW_API_KEY =
  process.env.QODERCLAW_API_KEY || "sk-qoderclaw-default-key";

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
        Authorization: `Bearer ${QODERCLAW_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("[QoderProxy] Backend returned error:", response.status);

      // 特殊处理 401 鉴权错误
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Authentication failed", message: "Invalid API key" },
          { status: 401 },
        );
      }

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

"use client";

import { useEffect } from "react";

export default function CleanupTokenPage() {
  useEffect(() => {
    // 清理 URL 中的 token 参数，但不刷新页面
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("token")) {
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }

      // 1 秒后跳转到首页
      setTimeout(() => {
        window.location.href = "/#/chat";
      }, 1000);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fafafa",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "40px",
        }}
      >
        <h2
          style={{ fontSize: "20px", color: "#1f948c", marginBottom: "20px" }}
        >
          认证中...
        </h2>
        <p style={{ color: "#666" }}>正在跳转，请稍候</p>
      </div>
    </div>
  );
}

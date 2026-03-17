"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 简单验证：尝试访问一个 API
      const response = await fetch("/api/config");

      if (response.ok) {
        // 设置 cookie
        document.cookie = `auth_token=${password}; path=/; max-age=${604800}`;

        // 重定向到首页
        setTimeout(() => {
          window.location.href = "/#/chat";
        }, 100);
      } else {
        setError("密码错误，请重试");
        setLoading(false);
      }
    } catch (err) {
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  };

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
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#1f948c",
              margin: "10px 0",
            }}
          >
            NextChat 访问认证
          </h1>
          <p style={{ color: "#666", fontSize: "14px" }}>请输入访问密码</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码..."
              autoFocus
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "16px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#ffebee",
                color: "#c62828",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "16px",
              fontWeight: "500",
              color: "white",
              backgroundColor: loading || !password.trim() ? "#ccc" : "#1f948c",
              border: "none",
              borderRadius: "8px",
              cursor: loading || !password.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "验证中..." : "进入系统"}
          </button>
        </form>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "20px",
            borderTop: "1px solid #eee",
            textAlign: "center",
            fontSize: "12px",
            color: "#999",
          }}
        >
          <p>首次访问？使用链接：</p>
          <p
            style={{
              marginTop: "5px",
              backgroundColor: "#f5f5f5",
              padding: "8px",
              borderRadius: "4px",
              wordBreak: "break-all",
            }}
          >
            http://192.168.20.2:3000/?token=qoder2026
          </p>
        </div>
      </div>
    </div>
  );
}

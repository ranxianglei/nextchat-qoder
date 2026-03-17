/**
 * Qoder Session 同步模块
 *
 * 将 ~/.qoder 中的持久化会话同步到 NextChat 本地存储
 */

import { ChatSession, ChatMessage, createMessage } from "./chat";
import { createEmptyMask } from "./mask";

// 使用 Next.js API 路由代理，避免跨域问题
// 生产环境和开发环境都使用相对路径访问后端
const API_BASE_URL = "/api";

export interface QoderSession {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  working_dir: string;
  has_transcript: boolean;
}

export interface QoderMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * 从 bridge 获取所有 Qoder sessions
 */
export async function fetchQoderSessions(): Promise<QoderSession[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/qoder-sessions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (e) {
    console.warn("[QoderSync] Failed to fetch sessions:", e);
    return [];
  }
}

/**
 * 从 bridge 获取指定 session 的 transcript
 * @param sessionId 会话 ID
 * @param offset 跳过前 N 条消息（用于增量获取）
 * @param limit 限制返回数量
 */
export async function fetchQoderTranscript(
  sessionId: string,
  offset: number = 0,
  limit: number = 0,
): Promise<{ messages: QoderMessage[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (offset > 0) params.set("offset", String(offset));
    if (limit !== 0) params.set("limit", String(limit));

    const url = `${API_BASE_URL}/qoder-sessions/${encodeURIComponent(
      sessionId,
    )}/transcript?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return { messages: [], total: 0 };
    const data = await res.json();
    return {
      messages: data.messages || [],
      total: data.total || data.messages?.length || 0,
    };
  } catch (e) {
    console.warn("[QoderSync] Failed to fetch transcript:", e);
    return { messages: [], total: 0 };
  }
}

/**
 * 将 Qoder session 转换为 NextChat ChatSession
 */
export function convertQoderToChatSession(
  qoder: QoderSession,
  messages: QoderMessage[],
): ChatSession {
  const now = Date.now();
  const chatMessages: ChatMessage[] = messages.map((m) =>
    createMessage({
      role: m.role,
      content: m.content,
      date: new Date(qoder.updated_at).toLocaleString(),
    }),
  );

  return {
    id: `qoder-${qoder.id}`, // 前缀区分 Qoder 导入的 session
    topic: qoder.title || "Untitled",
    memoryPrompt: "",
    messages: chatMessages,
    stat: {
      tokenCount: 0,
      wordCount: messages.reduce(
        (sum, m) => sum + m.content.split(/\s+/).length,
        0,
      ),
      charCount: messages.reduce((sum, m) => sum + m.content.length, 0),
    },
    lastUpdate: qoder.updated_at,
    lastSummarizeIndex: 0,
    mask: createEmptyMask(),
  };
}

/**
 * 同步 Qoder sessions 到本地
 * @param existingSessions 当前已有的 sessions（用于去重）
 * @returns 新增的 sessions
 */
export async function syncQoderSessions(
  existingSessions: ChatSession[],
): Promise<ChatSession[]> {
  const qoderSessions = await fetchQoderSessions();
  const existingQoderIds = new Set(
    existingSessions
      .filter((s) => s.id.startsWith("qoder-"))
      .map((s) => s.id.slice(6)), // 去掉 qoder- 前缀
  );

  const newSessions: ChatSession[] = [];

  // 只导入有实质内容的 session（>= 2 条消息），避免大量空会话
  const meaningful = qoderSessions.filter(
    (s) => s.message_count >= 2 && !existingQoderIds.has(s.id),
  );

  // 最多一次导入 20 个 session，按更新时间倒序（API 已排序）
  const toImport = meaningful.slice(0, 20);

  for (const qoder of toImport) {
    if (qoder.has_transcript) {
      // 对于消息数少的会话，获取完整消息（包含 tool events）
      // 对于消息数多的会话，限制为最后 100 条（显示最新消息）
      const limit = qoder.message_count <= 100 ? 0 : -100;
      const { messages } = await fetchQoderTranscript(qoder.id, 0, limit);
      const session = convertQoderToChatSession(qoder, messages);
      newSessions.push(session);
      console.log(
        `[QoderSync] Imported session: ${qoder.title} (${messages.length} messages, total: ${qoder.message_count})`,
      );
    }
  }

  return newSessions;
}

/**
 * 刷新指定 session 的消息（从 Qoder 拉取最新）
 * 返回增量更新的新消息列表
 */
export async function refreshQoderSession(
  sessionId: string,
  currentMessageCount: number = 0,
): Promise<QoderMessage[] | null> {
  if (!sessionId.startsWith("qoder-")) return null;

  const qoderId = sessionId.slice(6);

  // 消息数 <= 30 的会话使用全量刷新（包含 tool events）
  // 大于 30 的使用增量刷新
  const useFullRefresh = currentMessageCount <= 30;

  // 全量刷新：获取最后 100 条（避免一次性加载过多）
  // 增量刷新：从当前消息数开始，获取新增的
  const limit = useFullRefresh ? -100 : 0;
  const offset = useFullRefresh ? 0 : currentMessageCount;

  const { messages, total } = await fetchQoderTranscript(
    qoderId,
    offset,
    limit,
  );

  console.log(
    `[QoderSync] Refreshed session ${qoderId}: got ${messages.length} messages (offset: ${offset}, limit: ${limit}), total ${total}`,
  );

  // 返回消息（如果是全量刷新，返回全部；如果是增量，返回新消息）
  return messages;
}

/**
 * 加载更早的消息（向上滚动时触发）
 * @param sessionId 会话 ID
 * @param loadedCount 已加载的消息数量（从最新消息往前数）
 * @param pageSize 每次加载的数量
 * @returns 更早的消息列表（按时间正序排列）
 */
export async function loadOlderMessages(
  sessionId: string,
  loadedCount: number,
  pageSize: number = 100,
): Promise<QoderMessage[] | null> {
  if (!sessionId.startsWith("qoder-")) return null;

  const qoderId = sessionId.slice(6);
  const offset = loadedCount; // 跳过已加载的最新 N 条
  const limit = -pageSize; // 获取之前的 N 条（负数表示倒数）

  try {
    const { messages, total } = await fetchQoderTranscript(
      qoderId,
      offset,
      limit,
    );

    console.log(
      `[QoderSync] Loaded older messages for ${qoderId}: got ${messages.length} messages (offset: ${offset}, limit: ${limit}), total ${total}`,
    );

    // 如果没有更多消息，返回空数组
    if (messages.length === 0 || offset >= total) {
      return [];
    }

    return messages;
  } catch (e) {
    console.warn("[QoderSync] Failed to load older messages:", e);
    return null;
  }
}

/**
 * 删除 Qoder session
 */
export async function deleteQoderSession(sessionId: string): Promise<boolean> {
  if (!sessionId.startsWith("qoder-")) return false;

  const qoderId = sessionId.slice(6);
  try {
    const res = await fetch(
      `${API_BASE_URL}/qoder-sessions/${encodeURIComponent(qoderId)}`,
      {
        method: "DELETE",
      },
    );
    return res.ok;
  } catch (e) {
    console.warn("[QoderSync] Failed to delete session:", e);
    return false;
  }
}

/**
 * 检查 session 是否需要刷新（消息数变化）
 * 使用 transcript API 的 count_only 模式，轻量级获取处理后的真实消息数
 */
export async function checkSessionNeedsRefresh(
  session: ChatSession,
): Promise<boolean> {
  if (!session.id.startsWith("qoder-")) return false;

  const qoderId = session.id.slice(6);
  try {
    const url = `${API_BASE_URL}/qoder-sessions/${encodeURIComponent(
      qoderId,
    )}/transcript?count_only=true`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    const serverTotal = data.total || 0;
    return session.messages.length !== serverTotal;
  } catch (e) {
    return false;
  }
}

/**
 * 获取单个 session 的最新信息
 */
export async function fetchQoderSessionInfo(
  sessionId: string,
): Promise<QoderSession | null> {
  if (!sessionId.startsWith("qoder-")) return null;

  const qoderId = sessionId.slice(6);
  try {
    const sessions = await fetchQoderSessions();
    return sessions.find((s) => s.id === qoderId) || null;
  } catch (e) {
    return null;
  }
}

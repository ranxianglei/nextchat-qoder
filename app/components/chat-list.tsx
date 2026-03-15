import DeleteIcon from "../icons/delete.svg";

import styles from "./home.module.scss";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";

import { useChatStore } from "../store";

import Locale from "../locales";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { MaskAvatar } from "./mask";
import { Mask } from "../store/mask";
import { useRef, useEffect, useState, useMemo } from "react";
import { showConfirm } from "./ui-lib";
import { useMobileScreen } from "../utils";
import clsx from "clsx";

export function ChatItem(props: {
  onClick?: () => void;
  onDelete?: () => void;
  title: string;
  count: number;
  time: string;
  selected: boolean;
  id: string;
  index: number;
  narrow?: boolean;
  mask: Mask;
}) {
  const draggableRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (props.selected && draggableRef.current) {
      draggableRef.current?.scrollIntoView({
        block: "center",
      });
    }
  }, [props.selected]);

  const { pathname: currentPath } = useLocation();
  return (
    <Draggable draggableId={`${props.id}`} index={props.index}>
      {(provided) => (
        <div
          className={clsx(styles["chat-item"], {
            [styles["chat-item-selected"]]:
              props.selected &&
              (currentPath === Path.Chat || currentPath === Path.Home),
          })}
          onClick={props.onClick}
          ref={(ele) => {
            draggableRef.current = ele;
            provided.innerRef(ele);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          title={`${props.title}\n${Locale.ChatItem.ChatItemCount(
            props.count,
          )}`}
        >
          {props.narrow ? (
            <div className={styles["chat-item-narrow"]}>
              <div className={clsx(styles["chat-item-avatar"], "no-dark")}>
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
              <div className={styles["chat-item-narrow-count"]}>
                {props.count}
              </div>
            </div>
          ) : (
            <>
              <div className={styles["chat-item-title"]}>{props.title}</div>
              <div className={styles["chat-item-info"]}>
                <div className={styles["chat-item-count"]}>
                  {Locale.ChatItem.ChatItemCount(props.count)}
                </div>
                <div className={styles["chat-item-date"]}>{props.time}</div>
              </div>
            </>
          )}

          <div
            className={styles["chat-item-delete"]}
            onClickCapture={(e) => {
              props.onDelete?.();
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <DeleteIcon />
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function ChatList(props: { narrow?: boolean }) {
  const [sessions, selectedIndex, selectSession, moveSession] = useChatStore(
    (state) => [
      state.sessions,
      state.currentSessionIndex,
      state.selectSession,
      state.moveSession,
    ],
  );
  const chatStore = useChatStore();
  const navigate = useNavigate();
  const isMobileScreen = useMobileScreen();

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveSession(source.index, destination.index);
  };

  // 虚拟滚动优化：会话数量过多时只渲染可见区域
  const listRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const ITEM_HEIGHT = props.narrow ? 72 : 80; // 估算每个会话项的高度
  const OVERSCAN = 5; // 上下额外渲染的项数

  // 计算当前可见范围
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, clientHeight } = listRef.current;
      const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
      const end = Math.min(
        sessions.length,
        Math.ceil((scrollTop + clientHeight) / ITEM_HEIGHT) + OVERSCAN,
      );
      setVisibleRange({ start, end });
    };

    const list = listRef.current;
    if (list) {
      list.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll(); // 初始化
      return () => list.removeEventListener("scroll", handleScroll);
    }
  }, [sessions.length, props.narrow]);

  // 当会话数量少时禁用虚拟滚动（<100个）
  const useVirtualScroll = sessions.length > 100;

  // 渲染的会话列表
  const visibleSessions = useMemo(() => {
    if (!useVirtualScroll) return sessions;
    return sessions.slice(visibleRange.start, visibleRange.end);
  }, [sessions, visibleRange, useVirtualScroll]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="chat-list">
        {(provided) => (
          <div
            className={styles["chat-list"]}
            ref={(el) => {
              provided.innerRef(el);
              (listRef as any).current = el;
            }}
            {...provided.droppableProps}
            style={useVirtualScroll ? { overflow: "auto" } : undefined}
          >
            {/* 虚拟滚动时的顶部占位 */}
            {useVirtualScroll && visibleRange.start > 0 && (
              <div style={{ height: visibleRange.start * ITEM_HEIGHT }} />
            )}

            {visibleSessions.map((item, i) => {
              const actualIndex = useVirtualScroll ? visibleRange.start + i : i;
              return (
                <ChatItem
                  title={item.topic}
                  time={new Date(item.lastUpdate).toLocaleString()}
                  count={item.messages.length}
                  key={item.id}
                  id={item.id}
                  index={actualIndex}
                  selected={actualIndex === selectedIndex}
                  onClick={() => {
                    navigate(Path.Chat);
                    selectSession(actualIndex);
                  }}
                  onDelete={async () => {
                    if (
                      (!props.narrow && !isMobileScreen) ||
                      (await showConfirm(Locale.Home.DeleteChat))
                    ) {
                      chatStore.deleteSession(actualIndex);
                    }
                  }}
                  narrow={props.narrow}
                  mask={item.mask}
                />
              );
            })}

            {/* 虚拟滚动时的底部占位 */}
            {useVirtualScroll && visibleRange.end < sessions.length && (
              <div
                style={{
                  height: (sessions.length - visibleRange.end) * ITEM_HEIGHT,
                }}
              />
            )}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

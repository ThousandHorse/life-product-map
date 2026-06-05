/**
 * AiChatPane.tsx
 *
 * Pane 4: AI コーチチャット（目標モード時のみ表示）。
 * Phase 1 はモック UI のみ。送信するとダミーレスポンスを返す。
 * Phase 3 で Claude API（claude-haiku-4-5）に差し替える予定。
 */

"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
};

const DUMMY_RESPONSE =
  "なるほど、良い観点ですね。目標に対して着実に進んでいると感じます。引き続き小さなステップを積み重ねていきましょう。";

export function AiChatPane() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "ai",
      text: "こんにちは！目標達成に向けて、何でも相談してください。",
    },
  ]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // 送信後に最新メッセージが常に見えるよう末尾へスクロールする（チャット UX として自然な挙動）
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Phase 1: 固定のダミーレスポンスを非同期で返す
    // Phase 3 で claude-haiku-4-5 API コールに差し替える
    setTimeout(() => {
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        text: DUMMY_RESPONSE,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 600);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex w-[320px] flex-shrink-0 flex-col bg-canvas">
      {/* ヘッダー */}
      <div className="flex h-12 flex-shrink-0 items-center border-b border-border px-5">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground">
          AI COACH
        </span>
      </div>

      {/* チャットボディ */}
      <div
        ref={bodyRef}
        className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-5"
      >
        {messages.map((msg) =>
          msg.role === "ai" ? (
            <div
              key={msg.id}
              className="max-w-[86%] self-start rounded-[18px_18px_18px_5px] border border-border bg-card px-[15px] py-3 text-[13px] leading-[1.75] text-foreground"
            >
              {msg.text}
            </div>
          ) : (
            <div
              key={msg.id}
              className="max-w-[86%] self-end rounded-[18px_18px_5px_18px] bg-primary px-[15px] py-3 text-[13px] leading-[1.75] text-primary-foreground"
            >
              {msg.text}
            </div>
          )
        )}
      </div>

      {/* 入力バー */}
      <div className="flex flex-shrink-0 gap-[10px] border-t border-border bg-canvas px-4 py-[14px]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="AIに相談する…"
          className="h-[42px] flex-1 rounded-md border border-border bg-card px-[14px] text-[13px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          aria-label="送信"
          className="h-[42px] w-[42px] flex-shrink-0 cursor-pointer rounded-md bg-primary text-base text-primary-foreground"
        >
          ↑
        </button>
      </div>
    </div>
  );
}

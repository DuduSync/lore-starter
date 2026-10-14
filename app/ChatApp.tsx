"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccountInfo,
  ChatMessage,
  LoreApiError,
  fetchAccount,
  fetchModel,
  streamChat,
} from "@/lib/loreapi";

const KEY_STORAGE = "lorestarter.key";
const CHAT_STORAGE = "lorestarter.chat";
const SYSTEM_STORAGE = "lorestarter.system";

const DEFAULT_SYSTEM =
  "You are a creative roleplay assistant. Stay in character, be descriptive and keep the story moving.";

function friendlyError(err: unknown): string {
  if (err instanceof LoreApiError) {
    if (err.status === 401 || err.status === 403)
      return "Invalid API key. Double check it and try again.";
    if (err.status === 402)
      return "Not enough credits. Top up your account at loreapi.online.";
    if (err.status === 429)
      return "Weekly credit limit reached. Your credits renew Sunday at 00:00 (BRT).";
    return `LoreAPI error (${err.status}): ${err.message}`;
  }
  if (err instanceof Error && err.name === "AbortError") return "";
  return "Connection failed. Check your internet and try again.";
}

function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <p>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function ChatApp() {
  const [booted, setBooted] = useState(false);
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("loreapi-rp");
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [system, setSystem] = useState(DEFAULT_SYSTEM);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function connect(candidate: string, persist = true) {
    const trimmed = candidate.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const [acc, mdl] = await Promise.all([
        fetchAccount(trimmed),
        fetchModel(trimmed),
      ]);
      if (persist) localStorage.setItem(KEY_STORAGE, trimmed);
      setKey(trimmed);
      setAccount(acc);
      setModel(mdl);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const storedKey = localStorage.getItem(KEY_STORAGE) ?? "";
    const storedChat = localStorage.getItem(CHAT_STORAGE);
    const storedSystem = localStorage.getItem(SYSTEM_STORAGE);
    if (storedSystem) setSystem(storedSystem);
    if (storedChat) {
      try {
        setMessages(JSON.parse(storedChat));
      } catch {
        // ignore corrupted storage
      }
    }
    if (storedKey) {
      void connect(storedKey, false).finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (booted && !streaming) {
      localStorage.setItem(CHAT_STORAGE, JSON.stringify(messages));
    }
  }, [messages, streaming, booted]);

  useEffect(() => {
    if (booted) localStorage.setItem(SYSTEM_STORAGE, system);
  }, [system, booted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, streaming]);

  function disconnect() {
    abortRef.current?.abort();
    localStorage.removeItem(KEY_STORAGE);
    setKey("");
    setKeyInput("");
    setAccount(null);
    setError("");
    setStreaming(false);
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setError("");
  }

  async function refreshAccount() {
    if (!key) return;
    try {
      setAccount(await fetchAccount(key));
    } catch {
      // keep the previous value
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !key) return;
    setError("");
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const payload: ChatMessage[] = [
        { role: "system", content: system },
        ...next,
      ];
      let acc = "";
      for await (const delta of streamChat(
        key,
        model,
        payload,
        controller.signal,
      )) {
        acc += delta;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      void refreshAccount();
    } catch (err) {
      const msg = friendlyError(err);
      if (msg) setError(msg);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!booted) {
    return (
      <main className="center">
        <p className="muted">Loading...</p>
      </main>
    );
  }

  if (!key) {
    return (
      <main className="center">
        <div className="setup-card">
          <h1>LoreAPI Starter</h1>
          <p className="muted">
            A tiny open-source chat UI for{" "}
            <a href="https://loreapi.online" target="_blank" rel="noreferrer">
              LoreAPI
            </a>
            . Paste your API key to start. It stays in this browser.
          </p>

          <label className="field">
            <span>API key</span>
            <div className="key-row">
              <input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void connect(keyInput);
                }}
                placeholder="sk-lore-..."
                spellCheck={false}
                autoFocus
              />
              <button
                type="button"
                className="ghost"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="field">
            <span>System prompt (optional)</span>
            <textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={3}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button
            className="primary"
            onClick={() => void connect(keyInput)}
            disabled={busy || !keyInput.trim()}
          >
            {busy ? "Connecting..." : "Start chatting"}
          </button>

          <p className="muted small">
            No key yet?{" "}
            <a href="https://loreapi.online" target="_blank" rel="noreferrer">
              Create one at loreapi.online
            </a>
          </p>
        </div>
      </main>
    );
  }

  const credits = account?.credits;
  const modelPill = account?.key?.model === "loreapi-v2" ? "v2" : "v1";
  const weekUsage = account?.usage?.week_usd;

  return (
    <main className="chat">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          LoreAPI Starter
        </div>
        <div className="topbar-right">
          <span
            className="chip"
            title={
              weekUsage !== undefined
                ? `Used this week: $${weekUsage.toFixed(4)}`
                : "Credits left on your LoreAPI account"
            }
          >
            {credits !== undefined
              ? `${Math.round(credits).toLocaleString("en-US")} credits`
              : "..."}
          </span>
          <span className="pill" title="Model served by your key">
            {modelPill}
          </span>
          <button className="ghost" onClick={() => setShowSystem((v) => !v)}>
            System
          </button>
          <button className="ghost" onClick={newChat}>
            New chat
          </button>
          <button className="ghost" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      </header>

      {showSystem && (
        <div className="system-panel">
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={2}
            placeholder="System prompt"
          />
        </div>
      )}

      {error && <div className="banner error">{error}</div>}

      <section className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <h2>Start a story</h2>
            <p className="muted">
              Try: &ldquo;You wake up in a neon-lit alley of Neo S&atilde;o
              Paulo. What do you do?&rdquo;
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "assistant" && m.content === "" && streaming ? (
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
            ) : (
              m.content && <MessageText text={m.content} />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      <footer className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write your message..."
          rows={1}
        />
        {streaming ? (
          <button
            className="ghost"
            onClick={() => abortRef.current?.abort()}
          >
            Stop
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => void send()}
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </footer>
    </main>
  );
}

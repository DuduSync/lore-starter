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
import { Lang, Strings, detectLang, getStrings } from "@/lib/i18n";

const KEY_STORAGE = "lorestarter.key";
const CHAT_STORAGE = "lorestarter.chat";
const SYSTEM_STORAGE = "lorestarter.system";
const LANG_STORAGE = "lorestarter.lang";

const DEFAULT_SYSTEMS: Record<Lang, string> = {
  en: "You are a creative roleplay assistant. Stay in character, be descriptive and keep the story moving.",
  pt: "Você é um assistente criativo de roleplay. Mantenha o personagem, seja descritivo e mantenha a história andando.",
};

function friendlyError(err: unknown, t: Strings): string {
  if (err instanceof LoreApiError) {
    if (err.status === 401 || err.status === 403) return t.invalidKey;
    if (err.status === 402) return t.noCredits;
    if (err.status === 429) return t.weeklyLimit;
    return `${t.apiError} (${err.status}): ${err.message}`;
  }
  if (err instanceof Error && err.name === "AbortError") return "";
  return t.connectionFailed;
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
  const [lang, setLang] = useState<Lang>("en");
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState("loreapi-rp");
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [system, setSystem] = useState(DEFAULT_SYSTEMS.en);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [showSystem, setShowSystem] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<Lang>("en");

  const t = getStrings(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

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
      setError(friendlyError(err, getStrings(langRef.current)));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const storedKey = localStorage.getItem(KEY_STORAGE) ?? "";
    const storedChat = localStorage.getItem(CHAT_STORAGE);
    const storedSystem = localStorage.getItem(SYSTEM_STORAGE);
    const storedLang = localStorage.getItem(LANG_STORAGE);
    const initialLang: Lang =
      storedLang === "en" || storedLang === "pt" ? storedLang : detectLang();
    setLang(initialLang);
    if (storedSystem) {
      setSystem(storedSystem);
    } else {
      setSystem(DEFAULT_SYSTEMS[initialLang]);
    }
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
    if (booted) localStorage.setItem(LANG_STORAGE, lang);
  }, [lang, booted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, streaming]);

  function toggleLang() {
    const next: Lang = lang === "en" ? "pt" : "en";
    setLang(next);
    if (Object.values(DEFAULT_SYSTEMS).includes(system)) {
      setSystem(DEFAULT_SYSTEMS[next]);
    }
  }

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
      const msg = friendlyError(err, getStrings(langRef.current));
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

  const langButton = (
    <button
      className="ghost small-btn"
      onClick={toggleLang}
      title={t.langTitle}
      type="button"
    >
      {lang === "en" ? "PT-BR" : "EN"}
    </button>
  );

  if (!booted) {
    return (
      <main className="center">
        <p className="muted">{t.loading}</p>
      </main>
    );
  }

  if (!key) {
    return (
      <main className="center">
        <div className="setup-card">
          <div className="card-top">{langButton}</div>
          <h1>LoreAPI Starter</h1>
          <p className="muted">
            {t.setupIntroA}
            <a href="https://loreapi.online" target="_blank" rel="noreferrer">
              LoreAPI
            </a>
            {t.setupIntroB}
          </p>

          <label className="field">
            <span>{t.apiKeyLabel}</span>
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
                {showKey ? t.hide : t.show}
              </button>
            </div>
          </label>

          <label className="field">
            <span>{t.systemLabel}</span>
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
            {busy ? t.connecting : t.start}
          </button>

          <p className="muted small">
            {t.noKey}{" "}
            <a href="https://loreapi.online" target="_blank" rel="noreferrer">
              loreapi.online
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
                ? t.usedThisWeek.replace("{v}", weekUsage.toFixed(4))
                : t.creditsTitle
            }
          >
            {credits !== undefined
              ? `${Math.round(credits).toLocaleString(
                  lang === "pt" ? "pt-BR" : "en-US",
                )} ${t.creditsWord}`
              : "..."}
          </span>
          <span className="pill" title="Model served by your key">
            {modelPill}
          </span>
          {langButton}
          <button className="ghost" onClick={() => setShowSystem((v) => !v)}>
            {t.systemBtn}
          </button>
          <button className="ghost" onClick={newChat}>
            {t.newChat}
          </button>
          <button className="ghost" onClick={disconnect}>
            {t.disconnect}
          </button>
        </div>
      </header>

      {showSystem && (
        <div className="system-panel">
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={2}
            placeholder={t.systemPlaceholder}
          />
        </div>
      )}

      {error && <div className="banner error">{error}</div>}

      <section className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <h2>{t.emptyTitle}</h2>
            <p className="muted">{t.emptyHint}</p>
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
          placeholder={t.composerPlaceholder}
          rows={1}
        />
        {streaming ? (
          <button className="ghost" onClick={() => abortRef.current?.abort()}>
            {t.stop}
          </button>
        ) : (
          <button
            className="primary"
            onClick={() => void send()}
            disabled={!input.trim()}
          >
            {t.send}
          </button>
        )}
      </footer>
    </main>
  );
}

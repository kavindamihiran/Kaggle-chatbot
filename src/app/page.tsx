"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  FormEvent,
} from "react";
import SetupGuide from "./components/SetupGuide";
import {
  IconAlert,
  IconBook,
  IconPlug,
  IconSend,
  IconSettings,
  IconSpark,
  IconTrash,
  IconUser,
} from "./components/Icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [tempApiUrl, setTempApiUrl] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs to avoid stale closures
  const apiUrlRef = useRef(apiUrl);
  const apiKeyRef = useRef(apiKey);
  const messagesRef = useRef<Message[]>([]);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    apiUrlRef.current = apiUrl;
  }, [apiUrl]);
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const savedUrl = localStorage.getItem("kaggle-api-url");
    const savedKey = localStorage.getItem("kaggle-api-key");
    if (savedUrl) {
      setApiUrl(savedUrl);
      setTempApiUrl(savedUrl);
    }
    if (savedKey) {
      setApiKey(savedKey);
      setTempApiKey(savedKey);
    }
  }, []);

  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 168) + "px";
    }
  }, [input]);

  // Escape closes whichever overlay is on top.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showGuide) setShowGuide(false);
      else if (showSettings) setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showGuide, showSettings]);

  const openSettings = () => {
    setTempApiUrl(apiUrl);
    setTempApiKey(apiKey);
    setShowSettings(true);
  };

  const saveSettings = () => {
    const url = tempApiUrl.trim();
    const key = tempApiKey.trim();
    setApiUrl(url);
    setApiKey(key);
    localStorage.setItem("kaggle-api-url", url);
    localStorage.setItem("kaggle-api-key", key);
    setShowSettings(false);
  };

  const clearChat = () => {
    queueRef.current = [];
    processingRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setIsLoading(false);
  };

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsLoading(true);

    try {
      while (queueRef.current.length > 0) {
        queueRef.current.shift();

        // User message is already in messagesRef (added by sendMessage)
        // Snapshot messages up to this point for the API call
        const apiMessages = [...messagesRef.current];

        // Add empty assistant placeholder
        const assistantMsg: Message = { role: "assistant", content: "" };
        const withAssistant = [...messagesRef.current, assistantMsg];
        messagesRef.current = withAssistant;
        setMessages([...withAssistant]);

        const assistantIdx = withAssistant.length - 1;

        try {
          // Abort if the request takes longer than 60 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              messages: apiMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              apiUrl: apiUrlRef.current,
              apiKey: apiKeyRef.current,
            }),
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorMsg = `Server error (${response.status})`;
            try {
              const errData = await response.json();
              errorMsg = errData.error || errorMsg;
            } catch {
              // ignore parse error
            }
            throw new Error(errorMsg);
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response stream available");

          const decoder = new TextDecoder();
          let fullContent = "";

          // Safety: if no chunk arrives for 30 s, assume the stream stalled.
          let chunkTimer: ReturnType<typeof setTimeout> | null = null;
          const resetChunkTimer = () => {
            if (chunkTimer) clearTimeout(chunkTimer);
            chunkTimer = setTimeout(() => reader.cancel(), 30000);
          };

          resetChunkTimer();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              resetChunkTimer();
              const chunk = decoder.decode(value, { stream: true });
              fullContent += chunk;

              // Update the assistant message in place
              const updated = [...messagesRef.current];
              updated[assistantIdx] = {
                role: "assistant",
                content: fullContent,
              };
              messagesRef.current = updated;
              setMessages([...updated]);
            }
          } finally {
            if (chunkTimer) clearTimeout(chunkTimer);
          }

          if (!fullContent.trim()) {
            throw new Error(
              "Received an empty response from the model. Check if your Kaggle notebook is still running.",
            );
          }
        } catch (error) {
          const errMsg =
            error instanceof Error
              ? error.name === "AbortError"
                ? "Request timed out (60 s). The model server may be overloaded. Try again."
                : error.message
              : "An unknown error occurred";
          const updated = [...messagesRef.current];
          if (assistantIdx < updated.length) {
            updated[assistantIdx] = {
              role: "assistant",
              content: `⚠️ **Error:** ${errMsg}`,
            };
          }
          messagesRef.current = updated;
          setMessages([...updated]);
        }
      }
    } finally {
      // Always reset processing state so future messages are never blocked
      processingRef.current = false;
      setIsLoading(false);

      setTimeout(() => {
        textareaRef.current?.focus();
        scrollToBottom();
      }, 100);

      // Safety: if a message was queued between the while-loop exit and
      // cleanup, kick off another processing run on the next microtask.
      if (queueRef.current.length > 0) {
        queueMicrotask(() => processQueue());
      }
    }
  }, []);

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText) return;

    if (!apiUrlRef.current) {
      openSettings();
      return;
    }

    setInput("");

    // Add user message to UI immediately
    const userMsg: Message = { role: "user", content: msgText };
    messagesRef.current = [...messagesRef.current, userMsg];
    setMessages([...messagesRef.current]);

    // Queue the message for API processing
    queueRef.current.push(msgText);

    // Start processing if not already running
    if (!processingRef.current) {
      processQueue();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3);
        const newlineIdx = code.indexOf("\n");
        const codeContent = newlineIdx >= 0 ? code.slice(newlineIdx + 1) : code;
        return (
          <pre key={i}>
            <code>{codeContent}</code>
          </pre>
        );
      }
      const lines = part.split("\n");
      return lines.map((line, j) => {
        let rendered = line.replace(/`([^`]+)`/g, "<code>$1</code>");
        rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        if (!rendered.trim())
          return j < lines.length - 1 ? <br key={`${i}-${j}`} /> : null;
        return (
          <p key={`${i}-${j}`} dangerouslySetInnerHTML={{ __html: rendered }} />
        );
      });
    });
  };

  const suggestions = [
    "Write a Python script that renames files by date",
    "Explain async/await like I've only used callbacks",
    "Find the bug in this segfaulting C snippet",
    "Sketch a REST API for a bookmarking app",
  ];

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <div className="header-logo">
            <IconSpark size={19} />
          </div>
          <div className="header-info">
            <h1>Qwen AI Chat</h1>
            <span className={`status-pill ${apiUrl ? "" : "offline"}`}>
              <span className="status-dot" />
              {apiUrl ? "Qwen2.5-Coder-14B · Kaggle T4" : "Not connected"}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="ghost-btn"
            onClick={() => setShowGuide(true)}
            title="Kaggle setup guide"
          >
            <IconBook size={17} />
            <span className="label">Setup guide</span>
          </button>
          <button
            className="icon-btn"
            onClick={clearChat}
            title="Clear conversation"
            aria-label="Clear conversation"
            id="clear-chat-btn"
          >
            <IconTrash size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={openSettings}
            title="Settings"
            aria-label="Settings"
            id="settings-btn"
          >
            <IconSettings size={17} />
          </button>
        </div>
      </header>

      <div className="chat-area" id="chat-area" ref={chatAreaRef}>
        {messages.length === 0 ? (
          <div className="welcome">
            <span className="welcome-badge">
              <IconSpark size={14} />
              Qwen2.5-Coder-14B-Instruct
            </span>
            <h2>Your own coding model, running on a free Kaggle GPU</h2>
            <p>
              {apiUrl
                ? "Connected and ready. Ask a question, paste code, or start from one of these."
                : "Start the notebook on Kaggle, then paste its ngrok URL and key into Settings. The guide walks through both."}
            </p>
            {!apiUrl && (
              <div className="welcome-cta">
                <button className="btn btn-primary" onClick={() => setShowGuide(true)}>
                  <IconBook size={16} />
                  Open the setup guide
                </button>
                <button className="btn btn-secondary" onClick={openSettings}>
                  <IconPlug size={16} />
                  I have my URL and key
                </button>
              </div>
            )}
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === "assistant" ? (
                  <IconSpark size={17} />
                ) : (
                  <IconUser size={16} />
                )}
              </div>
              <div className="message-content">
                {msg.role === "assistant" && !msg.content && isLoading ? (
                  <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                ) : msg.content.startsWith("⚠️") ? (
                  <div className="error-toast">
                    <IconAlert />
                    <span>{msg.content.replace("⚠️ ", "").replace(/\*\*/g, "")}</span>
                  </div>
                ) : (
                  renderContent(msg.content)
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input - NEVER disabled */}
      <div className="input-area">
        <form className="input-wrapper" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              apiUrl
                ? "Ask anything. Shift + Enter for a new line"
                : "Connect your Kaggle notebook first to start chatting"
            }
            rows={1}
            disabled={false}
            id="chat-input"
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!input.trim()}
            aria-label="Send message"
            id="send-btn"
          >
            <IconSend size={18} />
          </button>
        </form>
        <p className="input-hint">
          Responses stream from your own Kaggle notebook. Keys stay in this
          browser.
        </p>
      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Connection settings"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-head">
              <div>
                <h2>Connection</h2>
                <p className="modal-desc">
                  Paste the ngrok URL and API key printed by your Kaggle
                  notebook. Both are stored in this browser only.
                </p>
              </div>
            </header>

            <div className="form-group">
              <label htmlFor="api-url-input">Ngrok URL</label>
              <input
                id="api-url-input"
                type="text"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                autoFocus
              />
              <p className="hint">
                From cell 2 of the notebook. <code>/v1</code> is appended for
                you.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="api-key-input">API key</label>
              <input
                id="api-key-input"
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="your-secret-api-key"
              />
              <p className="hint">
                The <code>API_KEY</code> value you chose in that same cell.
              </p>
            </div>

            <div className="modal-note">
              <IconBook size={16} />
              <span>
                No notebook running yet?{" "}
                <button
                  className="link-btn"
                  onClick={() => {
                    setShowSettings(false);
                    setShowGuide(true);
                  }}
                >
                  Open the Kaggle setup guide
                </button>{" "}
                (four cells, about five minutes).
              </span>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveSettings}>
                Save and connect
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <SetupGuide
          onClose={() => setShowGuide(false)}
          onOpenSettings={() => {
            setShowGuide(false);
            openSettings();
          }}
        />
      )}
    </div>
  );
}

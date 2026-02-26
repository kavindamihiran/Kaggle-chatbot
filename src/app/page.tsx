"use client";

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [tempApiUrl, setTempApiUrl] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kaggle-api-url");
    if (saved) {
      setApiUrl(saved);
      setTempApiUrl(saved);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const saveSettings = () => {
    const url = tempApiUrl.trim();
    setApiUrl(url);
    localStorage.setItem("kaggle-api-url", url);
    setShowSettings(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isLoading) return;

    if (!apiUrl) {
      setShowSettings(true);
      return;
    }

    const userMessage: Message = { role: "user", content: msgText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Add empty assistant message for streaming
    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          apiUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Server error (${response.status})`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response stream");

      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages([
                  ...newMessages,
                  { role: "assistant", content: fullContent },
                ]);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Stream interrupted") {
                // Skip parse errors for incomplete chunks
              }
            }
          }
        }
      }

      if (!fullContent) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "I received an empty response. Please try again.",
          },
        ]);
      }
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "An unknown error occurred";
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `⚠️ **Error:** ${errMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
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
    // Simple markdown-like rendering
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
      // Handle inline formatting
      const lines = part.split("\n");
      return lines.map((line, j) => {
        // Replace inline code
        let rendered = line.replace(
          /`([^`]+)`/g,
          "<code>$1</code>"
        );
        // Replace bold
        rendered = rendered.replace(
          /\*\*([^*]+)\*\*/g,
          "<strong>$1</strong>"
        );
        // Replace italic
        rendered = rendered.replace(
          /\*([^*]+)\*/g,
          "<em>$1</em>"
        );
        if (!rendered.trim()) return j < lines.length - 1 ? <br key={`${i}-${j}`} /> : null;
        return (
          <p
            key={`${i}-${j}`}
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        );
      });
    });
  };

  const suggestions = [
    "Write a Python hello world",
    "Explain async/await",
    "Debug a segfault in C",
    "Create a REST API in Node.js",
  ];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🤖</div>
          <div className="header-info">
            <h1>Qwen AI Chat</h1>
            <p>
              <span
                className={`status-dot ${apiUrl ? "" : "offline"}`}
              ></span>
              {apiUrl ? "Qwen2.5-Coder-14B" : "Not connected"}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={clearChat}
            title="Clear chat"
            id="clear-chat-btn"
          >
            🗑️
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setTempApiUrl(apiUrl);
              setShowSettings(true);
            }}
            title="Settings"
            id="settings-btn"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-area" id="chat-area">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-icon">✨</div>
            <h2>Welcome to Qwen AI Chat</h2>
            <p>
              Powered by Qwen2.5-Coder-14B-Instruct running on Kaggle GPU.
              {!apiUrl && (
                <>
                  <br />
                  <strong style={{ color: "#a78bfa" }}>
                    Click ⚙️ to set your ngrok URL first.
                  </strong>
                </>
              )}
            </p>
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
                {msg.role === "assistant" ? "🤖" : "👤"}
              </div>
              <div className="message-content">
                {msg.role === "assistant" && !msg.content && isLoading ? (
                  <div className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                ) : msg.content.startsWith("⚠️") ? (
                  <div className="error-toast">{msg.content.replace("⚠️ ", "")}</div>
                ) : (
                  renderContent(msg.content)
                )}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        <form className="input-wrapper" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              apiUrl
                ? "Type your message... (Shift+Enter for new line)"
                : "Set your ngrok URL in ⚙️ Settings first..."
            }
            rows={1}
            disabled={isLoading}
            id="chat-input"
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!input.trim() || isLoading}
            id="send-btn"
          >
            ➤
          </button>
        </form>
        <p className="input-hint">
          Qwen2.5-Coder-14B-Instruct · Kaggle T4 GPU · Streaming enabled
        </p>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ Settings</h2>
            <p className="modal-desc">
              Paste your ngrok URL from the Kaggle notebook. This URL changes
              each time you restart the notebook.
            </p>
            <div className="form-group">
              <label htmlFor="api-url-input">Ngrok API URL</label>
              <input
                id="api-url-input"
                type="text"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                autoFocus
              />
              <p className="hint">
                Example: https://abc123.ngrok-free.app — the /v1 will be added automatically
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveSettings}>
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

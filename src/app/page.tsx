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
  const [apiKey, setApiKey] = useState("");
  const [tempApiUrl, setTempApiUrl] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const key = tempApiKey.trim();
    setApiUrl(url);
    setApiKey(key);
    localStorage.setItem("kaggle-api-url", url);
    localStorage.setItem("kaggle-api-key", key);
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

    // Add empty assistant message for typing indicator
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
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status})`);
      }

      if (data.content) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.content },
        ]);
      } else {
        throw new Error("No response content received from the model.");
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
              setTempApiKey(apiKey);
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
                    Click ⚙️ to set your ngrok URL and API key first.
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
                : "Set your ngrok URL & API key in ⚙️ Settings first..."
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
              Connect to your Kaggle-hosted model. Run the notebook to get your
              ngrok URL and API key, then paste them below.
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
                The URL printed in your Kaggle notebook — /v1 is added automatically
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="api-key-input">API Key</label>
              <input
                id="api-key-input"
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="your-secret-api-key"
              />
              <p className="hint">
                The API_KEY value from your Kaggle notebook (e.g. my-secret-key-xxx)
              </p>
            </div>
            <div className="setup-steps">
              <p className="setup-title">📋 Quick Setup</p>
              <ol>
                <li>Open your Kaggle notebook and run all cells</li>
                <li>Copy the <strong>ngrok URL</strong> and <strong>API Key</strong> from the output</li>
                <li>Paste them above and click Save</li>
              </ol>
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

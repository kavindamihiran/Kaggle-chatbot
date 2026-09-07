"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";

export default function CodeCell({
  label,
  code,
}: {
  label?: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked — the code stays selectable either way.
    }
  };

  return (
    <div className="code-cell">
      <div className="code-cell-bar">
        <span className="code-cell-label">{label ?? "python"}</span>
        <button
          type="button"
          className="copy-btn"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

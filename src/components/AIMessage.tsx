"use client";
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Clipboard, Check } from "lucide-react";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 text-[#484F58] hover:text-[#C9D1D9] transition-colors"
    >
      {copied ? <Check size={13} color="#7EE787" /> : <Clipboard size={13} />}
    </button>
  );
}

function parseAIContent(raw: string) {
  // Strip known AI prefixes
  const content = raw
    .replace(/^###\s*🧠\s*LOGIC_EXPLAINED\s*/i, "")
    .replace(/^\[AI CODE REVIEW\]\s*/i, "")
    .replace(/^\[SYSTEM_DIAGNOSTIC_REPORT\].*\n?/i, "")
    .trim();

  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join("\n");
      blocks.push(
        <div key={key++} className="my-2 rounded-lg overflow-hidden border border-[#1a2a4a]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0f1a] border-b border-[#1a2a4a]">
            <span className="text-[9px] text-[#3d5a8a] tracking-widest uppercase font-mono">{lang}</span>
            <CopyButton text={code} />
          </div>
          <SyntaxHighlighter
            language={lang.toLowerCase()}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: "12px", background: "#060b14", fontSize: "12px", fontFamily: "'Fira Code', monospace" }}
            codeTagProps={{ style: { fontFamily: "'Fira Code', monospace" } }}
          >
            {code.trim()}
          </SyntaxHighlighter>
        </div>
      );
      continue;
    }

    // Bold header line (e.g. **Summary** or **What it does**)
    const boldHeaderMatch = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (boldHeaderMatch) {
      blocks.push(
        <div key={key++} className="flex items-center gap-2 mt-3 mb-1 first:mt-0">
          <div className="w-1 h-4 rounded-full bg-[#1e4a8a] shrink-0" />
          <span className="text-[11px] text-[#58A6FF] font-bold tracking-widest uppercase">{boldHeaderMatch[1]}</span>
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---") {
      blocks.push(<div key={key++} className="my-2 border-t border-[#1a2a4a]" />);
      i++;
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const m = lines[i].match(/^\d+\.\s+(.+)/);
        if (m) items.push(m[1]);
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1 pl-0 flex flex-col gap-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-[12px] text-[#8ba3c7] leading-relaxed">
              <span className="text-[#1e4a8a] font-bold shrink-0 w-4 text-right">{idx + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list item
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        const m = lines[i].match(/^[-*]\s+(.+)/);
        if (m) items.push(m[1]);
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1 flex flex-col gap-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-[12px] text-[#8ba3c7] leading-relaxed">
              <span className="text-[#1e4a8a] mt-1 shrink-0">▸</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph text
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("```") && !lines[i].match(/^\*\*(.+?)\*\*\s*$/) && !lines[i].match(/^[-*]\s+/) && !lines[i].match(/^\d+\.\s+/) && lines[i].trim() !== "---") {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={key++} className="text-[12px] text-[#8ba3c7] leading-relaxed my-0.5">
          {renderInline(paraLines.join(" "))}
        </p>
      );
    }
  }

  return blocks;
}

// Render inline markdown: **bold**, `code`, plain text
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-[#C9D1D9] font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-[#0a0f1a] border border-[#1a2a4a] text-[#58A6FF] text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function AIMessage({ content }: { content: string }) {
  const blocks = parseAIContent(content);

  return (
    <div className="w-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#1a2a4a]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] animate-pulse" />
        <span className="text-[9px] text-[#3d5a8a] tracking-[2px] uppercase font-mono">Neural Engine · AI Analysis</span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5">
        {blocks}
      </div>
    </div>
  );
}
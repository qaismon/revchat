"use client";
import React, { useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Clipboard, Check, Terminal, Zap } from "lucide-react";
import hljs from 'highlight.js';
import VoiceMessage from "./VoiceMessage"; 

interface CodeBlockProps {
  code: string;
  language: string;
  isAutoDetected?: boolean;
}

const CodeBlock = ({ code, language, isAutoDetected }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isAutoDetected ? <Zap size={14} color="#E3B341" /> : <Terminal size={14} color="#7EE787" />}
          <span style={labelStyle}>
            {(language || "text").toLowerCase()} {isAutoDetected ? "// AUTO_DETECT" : "// COLLAB_SESSION"}
          </span>
        </div>
        <button onClick={copyToClipboard} style={copyButtonStyle}>
          {copied ? <Check size={14} color="#7EE787" /> : <Clipboard size={14} />}
        </button>
      </div>

    <SyntaxHighlighter 
  language={(language || "text").toLowerCase()} 
  style={vscDarkPlus} 
  customStyle={highlighterStyle}
  showLineNumbers={true} // Enables the line numbers
  lineNumberStyle={{ 
    minWidth: "2.5em", 
    paddingRight: "1em", 
    color: "#484F58", 
    textAlign: "right",
    userSelect: "none" // Prevents numbers from being highlighted when selecting code
  }} 
  codeTagProps={{
    style: { fontFamily: "'Fira Code', monospace" }
  }}
>
  {code.trim()}
</SyntaxHighlighter>
    </div>
  );
};

export default function CodeReviewer({ text }: { text: string }) {
  const content = text || "";

  if (text.startsWith("AUDIO_PACKET:")) {
    const audioSrc = text.replace("AUDIO_PACKET:", "");
    
    return (
      <div style={{ margin: "5px 0" }}>
        <div style={{ color: "#7EE787", fontSize: "10px", fontFamily: "monospace", opacity: 0.8 }}>
          // INCOMING_VOICE_NOTE
        </div>
        <VoiceMessage src={audioSrc} />
      </div>
    );
  }

  // Use useMemo to prevent re-running heavy detection on every re-render
  const renderedContent = useMemo(() => {
    const parts = [];
    const codeBlockRegex = /```(\w*)\s*\n?([\s\S]*?)\n?```/g;
    let lastIndex = 0;
    let match;

    // 1. PRIMARY: Explicit Backtick Detection
    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
      }
      parts.push(
        <CodeBlock 
          key={`code-${match.index}`} 
          language={match[1]} 
          code={match[2]} 
        />
      );
      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);

      // 2. SECONDARY: Auto-Detection (Only if no backticks were used at all)
      if (parts.length === 0) {
        const detection = hljs.highlightAuto(remainingText);
        // Relevance score threshold: prevents plain sentences from becoming code blocks
        if (detection.relevance > 5) {
          return (
            <CodeBlock 
              language={detection.language || "javascript"} 
              code={remainingText} 
              isAutoDetected={true} 
            />
          );
        }
      }
      
      parts.push(<span key={`text-${lastIndex}`}>{remainingText}</span>);
    }

    return parts;
  }, [content]);

  return (
    <div style={{ lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {renderedContent}
    </div>
  );
}

// --- STYLES (Keep existing styles from your previous code) ---
const containerStyle: React.CSSProperties = { margin: "12px 0", borderRadius: "6px", border: "1px solid #30363D", background: "#0D1117", overflow: "hidden" };
const headerStyle: React.CSSProperties = { background: "#161B22", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #30363D" };
const labelStyle: React.CSSProperties = { fontSize: "11px", color: "#8B949E", fontFamily: "'Fira Code', monospace" };
const copyButtonStyle: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "#8B949E", padding: "4px" };
const highlighterStyle: React.CSSProperties = { margin: 0, padding: "16px", fontSize: "13px", background: "transparent", fontFamily: "'Fira Code', monospace" };
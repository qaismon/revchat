"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01";

function MatrixColumn({ delay, duration, left }: { delay: number; duration: number; left: number }) {
  return (
    <div
      className="absolute top-0 text-[10px] leading-[14px] text-[#7EE787] opacity-[0.07] font-mono select-none pointer-events-none"
      style={{ left: `${left}%`, animation: `matrixFall ${duration}s ${delay}s linear infinite` }}
    >
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i}>{MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]}</div>
      ))}
    </div>
  );
}

const features = [
  {
    group: "SECURITY",
    color: "#7EE787",
    border: "#238636",
    bg: "#0d2218",
    items: [
      { icon: "🔐", label: "RSA-OAEP + AES-GCM E2EE", desc: "Military-grade encryption on every DM" },
      { icon: "🔑", label: "Per-user key pairs", desc: "Keys stored locally, never on server" },
      { icon: "🍪", label: "JWT auth + cookies", desc: "Secure session management" },
      { icon: "📧", label: "Password reset via email", desc: "Forgot password flow built in" },
    ]
  },
  {
    group: "MESSAGING",
    color: "#58A6FF",
    border: "#1a3a6e",
    bg: "#0a1628",
    items: [
      { icon: "💬", label: "Real-time via Socket.io", desc: "Instant delivery, zero polling" },
      { icon: "✓✓", label: "Delivery status ticks", desc: "Sending → sent → delivered → seen" },
      { icon: "↩", label: "Reply & delete", desc: "Reply to any message, delete for everyone" },
      { icon: "👥", label: "Groups & DMs", desc: "E2EE direct chats + group channels" },
    ]
  },
  {
    group: "MEDIA",
    color: "#a78bfa",
    border: "#4c1d95",
    bg: "#130d24",
    items: [
      { icon: "🎙", label: "Voice messages", desc: "Record & send audio in-chat" },
      { icon: "📎", label: "File sharing up to 15MB", desc: "Images inline, PDFs as links" },
      { icon: "🖱", label: "Drag & drop upload", desc: "Drop files with optional caption" },
      { icon: "👁", label: "Image preview", desc: "Preview before sending" },
    ]
  },
  {
    group: "AI FEATURES",
    color: "#ADC6FF",
    border: "#1a2a4a",
    bg: "#060b14",
    items: [
      { icon: "🤖", label: "AI code review", desc: "RUN_AI_REVIEW or DEBUG_MY_CODE on any code block" },
      { icon: "🧠", label: "Logic explanation", desc: "EXPLAIN_LOGIC breaks down any snippet" },
      { icon: "💡", label: "Context menu AI", desc: "Right-click any message to ask AI about it" },
      { icon: "✏️", label: "Code editor panel", desc: "Edit peer's code and send back as patch" },
    ]
  },
];

const codeDemo = `// Send code by wrapping in triple backticks:

\`\`\`js
function encrypt(data, key) {
  return crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key, data
  );
}
\`\`\`

// RevChat auto-detects it → shows syntax
// highlighting + AI action buttons below`;

export default function Home() {
  const [typed, setTyped] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [visibleSections, setVisibleSections] = useState<number[]>([]);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fullText = "REVCHAT_v1.1";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setTyped(fullText.slice(0, i + 1));
      i++;
      if (i >= fullText.length) clearInterval(interval);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = sectionRefs.current.indexOf(e.target as HTMLDivElement);
          if (idx !== -1) setVisibleSections(prev => prev.includes(idx) ? prev : [...prev, idx]);
        }
      }),
      { threshold: 0.15 }
    );
    sectionRefs.current.forEach(r => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  const cols = Array.from({ length: 20 }, (_, i) => ({
    delay: Math.random() * 5,
    duration: 8 + Math.random() * 10,
    left: i * 5 + Math.random() * 4,
  }));

  return (
    <div className="min-h-screen bg-[#07090c] font-mono text-[#C9D1D9] overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Fira Code', monospace; }
        @keyframes matrixFall {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 10px rgba(126,231,135,0.3); }
          50% { text-shadow: 0 0 30px rgba(126,231,135,0.8), 0 0 60px rgba(126,231,135,0.3); }
        }
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .glow-text { animation: glow 3s ease-in-out infinite; }
        .float { animation: float 4s ease-in-out infinite; }
        .scanline::after {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(transparent, rgba(126,231,135,0.05), transparent);
          animation: scanline 4s linear infinite;
          pointer-events: none;
        }
        .card-hover {
          transition: all 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-2px);
        }
        pre { white-space: pre-wrap; }
      `}</style>

      {/* Matrix background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {cols.map((c, i) => <MatrixColumn key={i} {...c} />)}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090c] via-transparent to-[#07090c]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#1a1f2e]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#7EE787] animate-pulse" />
          <span className="text-[11px] text-[#484F58] tracking-widest">RevChat v1.1</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#30363d] tracking-wide hidden sm:block">E2EE · REAL-TIME · AI-POWERED</span>
          <Link href="/login"
            className="px-4 py-2 text-[11px] tracking-widest text-[#7EE787] border border-[#238636] rounded bg-[#23863611] hover:bg-[#23863633] transition-colors">
            LOGIN →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] px-6 text-center scanline">
        <div className="fade-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
          <div className="text-[11px] text-[#484F58] tracking-[4px] mb-6 uppercase">
            ❯ INITIALIZING_SESSION...
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight glow-text text-[#7EE787] mb-2">
            {typed}<span className={`${cursorVisible ? "opacity-100" : "opacity-0"} transition-opacity`}>█</span>
          </h1>
          <p className="text-[#484F58] text-sm tracking-widest mt-4 mb-2">
            // SECURE · ENCRYPTED · DEVELOPER-FIRST CHAT
          </p>
        </div>

        <div className="fade-up mt-8 max-w-xl" style={{ animationDelay: "0.4s", opacity: 0 }}>
          <p className="text-[#8B949E] text-sm leading-relaxed">
            A terminal-aesthetic chat app built for developers. End-to-end encrypted DMs,
            real-time group channels, voice messages, file sharing, and an AI assistant
            that understands your code.
          </p>
        </div>

        <div className="fade-up flex flex-col sm:flex-row gap-3 mt-10" style={{ animationDelay: "0.6s", opacity: 0 }}>
          <Link href="/login"
            className="px-8 py-3 text-sm font-bold tracking-widest text-[#07090c] bg-[#7EE787] rounded hover:bg-[#9ef0a8] transition-colors">
            LAUNCH_APP
          </Link>
          <a href="#features"
            className="px-8 py-3 text-sm tracking-widest text-[#7EE787] border border-[#238636] rounded hover:bg-[#23863611] transition-colors">
            VIEW_FEATURES
          </a>
        </div>

        {/* Stats */}
        <div className="fade-up flex flex-wrap justify-center gap-8 mt-16" style={{ animationDelay: "0.8s", opacity: 0 }}>
          {[
            { label: "ENCRYPTION", value: "RSA-4096" },
            { label: "LATENCY", value: "<50ms" },
            { label: "FILE_LIMIT", value: "15MB" },
            { label: "AI_MODEL", value: "LLaMA-70B" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-[#58A6FF]">{value}</span>
              <span className="text-[9px] text-[#484F58] tracking-widest">{label}</span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-8 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-[#484F58]" />
          <span className="text-[9px] text-[#484F58] tracking-widest">SCROLL</span>
        </div>
      </section>

      {/* Code demo section */}
      <section className="relative z-10 px-6 py-20 max-w-4xl mx-auto" id="features">
        <div
          ref={el => { sectionRefs.current[0] = el; }}
          className={`transition-all duration-700 ${visibleSections.includes(0) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="text-center mb-12">
            <div className="text-[10px] text-[#484F58] tracking-[3px] mb-2">// SEND_CODE_IN_CHAT</div>
            <h2 className="text-2xl font-bold text-[#C9D1D9]">Code-first messaging</h2>
            <p className="text-[#484F58] text-sm mt-2">Wrap code in triple backticks with a language name — RevChat auto-detects, syntax-highlights, and adds AI action buttons.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Code input demo */}
            <div className="border border-[#1a2a4a] rounded-xl overflow-hidden bg-[#060b14]">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0f1a] border-b border-[#1a2a4a]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                <span className="text-[10px] text-[#3d5a8a] ml-2 tracking-wider">message_input.tsx</span>
              </div>
              <pre className="p-4 text-[11px] text-[#58A6FF] leading-relaxed overflow-auto">{codeDemo}</pre>
            </div>

            {/* AI buttons demo */}
            <div className="border border-[#1a2a4a] rounded-xl overflow-hidden bg-[#060b14]">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0f1a] border-b border-[#1a2a4a]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] animate-pulse" />
                <span className="text-[10px] text-[#3d5a8a] tracking-wider">ai_actions.tsx · auto-detected</span>
              </div>
              <div className="p-4">
                <div className="text-[10px] text-[#3d5a8a] mb-3">// Code block detected → buttons appear:</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["RUN_AI_REVIEW", "EXPLAIN_LOGIC", "OPEN_IN_EDITOR", "DEBUG_MY_CODE"].map(btn => (
                    <span key={btn} className="px-2 py-1 text-[9px] border border-[#1a2a4a] rounded text-[#58A6FF] bg-[#0a0f1a] tracking-wide">{btn}</span>
                  ))}
                </div>
                <div className="border border-[#1a2a4a] rounded-lg p-3 bg-[#040810]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] animate-pulse" />
                    <span className="text-[9px] text-[#3d5a8a] tracking-widest uppercase">Neural Engine · AI Analysis</span>
                  </div>
                  <div className="text-[11px] text-[#8ba3c7] leading-relaxed">
                    <span className="text-[#58A6FF] font-bold">Summary</span><br/>
                    The <code className="px-1 bg-[#0a0f1a] rounded text-[#58A6FF] text-[10px]">encrypt()</code> function wraps the Web Crypto API to perform AES-GCM encryption asynchronously using a provided key and IV...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 px-6 py-10 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((group, gi) => (
            <div
              key={group.group}
              ref={el => { sectionRefs.current[gi + 1] = el; }}
              className={`card-hover border rounded-xl overflow-hidden transition-all duration-700 ${visibleSections.includes(gi + 1) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ borderColor: group.border, background: group.bg, transitionDelay: `${gi * 0.1}s` }}
            >
              <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: group.border }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
                <span className="text-[10px] tracking-[3px] font-bold" style={{ color: group.color }}>
                  // {group.group}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {group.items.map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <div>
                      <div className="text-[12px] font-semibold" style={{ color: group.color }}>{item.label}</div>
                      <div className="text-[11px] text-[#484F58] mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Infrastructure badges */}
      <section
        ref={el => { sectionRefs.current[5] = el; }}
        className={`relative z-10 px-6 py-16 max-w-4xl mx-auto text-center transition-all duration-700 ${visibleSections.includes(5) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <div className="text-[10px] text-[#484F58] tracking-[3px] mb-6">// INFRASTRUCTURE</div>
        <div className="flex flex-wrap justify-center gap-2">
          {["Next.js 16", "TypeScript", "MongoDB", "Socket.io", "UploadThing", "AWS EC2", "Nginx", "PM2", "Fira Code"].map(tech => (
            <span key={tech} className="px-3 py-1.5 text-[10px] text-[#8B949E] border border-[#1a1f2e] rounded-full bg-[#0d1117] tracking-wide">
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        ref={el => { sectionRefs.current[6] = el; }}
        className={`relative z-10 px-6 py-24 text-center transition-all duration-700 ${visibleSections.includes(6) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <div className="max-w-lg mx-auto">
          <div className="text-[10px] text-[#484F58] tracking-[3px] mb-4">// READY_TO_CONNECT</div>
          <h2 className="text-3xl font-bold text-[#7EE787] glow-text mb-4">Start chatting securely</h2>
          <p className="text-[#484F58] text-sm mb-8 leading-relaxed">
            Every message encrypted. Every file protected. Every conversation private.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-3 px-10 py-4 text-sm font-bold tracking-widest text-[#07090c] bg-[#7EE787] rounded-lg hover:bg-[#9ef0a8] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(126,231,135,0.3)]">
            <span>INITIALIZE_SESSION</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1a1f2e] px-6 py-6 text-center">
        <div className="text-[10px] text-[#30363d] tracking-widest">
          RevChat v1.1 · Built with Next.js · E2EE by default · 
          <span className="text-[#238636] ml-2">● SECURE</span>
        </div>
      </footer>
    </div>
  );
}
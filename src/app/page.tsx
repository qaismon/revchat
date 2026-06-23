"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, vis] as const;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} className={className} style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(28px)", transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s` }}>
      {children}
    </div>
  );
}

const KANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモ01";

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const cols = Math.floor(c.width / 18);
    const drops = Array.from({ length: cols }, () => Math.random() * -100);
    const tick = () => {
      ctx.fillStyle = "rgba(7,9,12,0.05)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = "13px 'Fira Code', monospace";
      drops.forEach((y, i) => {
        const bright = Math.random() > 0.92;
        ctx.fillStyle = bright ? "rgba(126,231,135,0.9)" : "rgba(126,231,135,0.12)";
        ctx.fillText(KANA[Math.floor(Math.random() * KANA.length)], i * 18, y * 18);
        if (y * 18 > c.height && Math.random() > 0.975) drops[i] = 0;
        else drops[i] = y + 0.5;
      });
    };
    const id = setInterval(tick, 50);
    return () => { clearInterval(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-40" />;
}

const CHAT_MSGS = [
  { from: "peer", name: "adhil", text: "yo check this function", delay: 0 },
  { from: "peer", name: "adhil", code: "```js\nconst encrypt = async (data, key) => {\n  const iv = crypto.getRandomValues(\n    new Uint8Array(12)\n  );\n  return crypto.subtle.encrypt(\n    {name:'AES-GCM', iv}, key, data\n  );\n};", delay: 600 },
  { from: "me", text: "running AI review...", delay: 1400 },
  { from: "ai", text: "**Summary**\nThe `encrypt()` function implements AES-GCM symmetric encryption. The random IV ensures semantic security — identical plaintexts produce different ciphertexts.\n\n**Issues Found**\nNo IV is returned alongside the ciphertext — the caller cannot decrypt without it. Return `{ciphertext, iv}` as a pair.\n\n**Revised Code**\n```js\nreturn { ciphertext: await crypto.subtle\n  .encrypt({name:'AES-GCM',iv},key,data), iv };\n```", delay: 2400 },
];

function LiveChat() {
  const [visible, setVisible] = useState<number[]>([]);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    CHAT_MSGS.forEach((m, i) => {
      setTimeout(() => setVisible(v => [...v, i]), m.delay);
    });
  }, [inView]);

  return (
    <div ref={ref} className="rounded-2xl overflow-hidden border" style={{ borderColor: "#1a2a4a", background: "#060b14" }}>
      {/* Window bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1a2a4a", background: "#040810" }}>
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#7EE787] animate-pulse" />
          <span className="text-[10px]" style={{ color: "#3d5a8a" }}>adhil [ENCRYPTED] · Socket.io</span>
        </div>
        <span className="text-[10px]" style={{ color: "#238636" }}>● SECURE</span>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-3 min-h-[280px]">
        {CHAT_MSGS.map((m, i) => (
          <div key={i} style={{ opacity: visible.includes(i) ? 1 : 0, transform: visible.includes(i) ? "none" : "translateY(8px)", transition: "all 0.5s cubic-bezier(.16,1,.3,1)" }}>
            {m.from === "peer" && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-lg border text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5" style={{ borderColor: "#1a3a6e", color: "#58A6FF", background: "#0a1628" }}>A</div>
                <div>
                  <div className="text-[9px] mb-1" style={{ color: "#3d5a8a" }}>{m.name}</div>
                  {m.text && <div className="px-3 py-2 rounded-xl rounded-tl-none text-[12px] border" style={{ borderColor: "#1a3a6e", background: "#0a1628", color: "#C9D1D9" }}><span style={{ color: "#58A6FF" }}>$</span> {m.text}</div>}
                  {m.code && (
                    <div className="rounded-xl rounded-tl-none border overflow-hidden" style={{ borderColor: "#1a3a6e" }}>
                      <div className="px-3 py-1.5 border-b flex justify-between" style={{ borderColor: "#1a2a4a", background: "#040810" }}>
                        <span className="text-[9px]" style={{ color: "#3d5a8a" }}>javascript</span>
                        <span className="text-[9px]" style={{ color: "#28c840" }}>AUTO_DETECTED</span>
                      </div>
                      <pre className="px-3 py-2 text-[10px] leading-relaxed" style={{ color: "#ADC6FF", background: "#040810" }}>{m.code.replace("```js\n", "").replace("\n```", "")}</pre>
                      <div className="px-3 py-2 flex gap-2 flex-wrap" style={{ background: "#060b14" }}>
                        {["RUN_AI_REVIEW", "EXPLAIN_LOGIC", "OPEN_IN_EDITOR"].map(b => (
                          <span key={b} className="px-2 py-0.5 text-[9px] rounded border" style={{ color: "#58A6FF", borderColor: "#1a3a6e", background: "#0a0f1a" }}>{b}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {m.from === "me" && (
              <div className="flex gap-2 items-start justify-end">
                <div className="px-3 py-2 rounded-xl rounded-tr-none text-[12px] border" style={{ borderColor: "#238636", background: "#0d2218", color: "#7EE787" }}>
                  <span style={{ color: "#7EE787" }}>&gt;</span> {m.text}
                </div>
                <div className="w-7 h-7 rounded-lg border text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5" style={{ borderColor: "#238636", color: "#7EE787", background: "#0d2218" }}>Q</div>
              </div>
            )}
            {m.from === "ai" && (
              <div className="rounded-xl border p-3" style={{ borderColor: "#1a2a4a", background: "#040810" }}>
                <div className="flex items-center gap-2 mb-2.5 pb-2 border-b" style={{ borderColor: "#1a2a4a" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] animate-pulse" />
                  <span className="text-[9px] tracking-widest" style={{ color: "#3d5a8a" }}>NEURAL ENGINE · LLaMA-70B ANALYSIS</span>
                </div>
                <div className="space-y-1.5">
                  {m.text && m.text.split("\n\n").map((para, pi) => (
                    <div key={pi} className="text-[11px] leading-relaxed" style={{ color: "#8ba3c7" }}>
                      {para.startsWith("**") ? (
                        <><span className="font-bold" style={{ color: "#58A6FF" }}>{para.match(/\*\*(.+?)\*\*/)?.[1]}</span><br /><span>{para.replace(/\*\*(.+?)\*\*\n?/, "")}</span></>
                      ) : para.startsWith("```") ? (
                        <pre className="px-2 py-1.5 rounded text-[10px] mt-1" style={{ background: "#0a0f1a", color: "#ADC6FF" }}>{para.replace(/```js\n?|\n?```/g, "")}</pre>
                      ) : <span>{para}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: "#1a2a4a", background: "#040810" }}>
        <span className="text-sm" style={{ color: "#7EE787" }}>$</span>
        <span className="text-sm flex-1" style={{ color: "#1e2d42" }}>type_message_here...</span>
        <div className="flex gap-1.5">
          {["📎","🎙","😊"].map(e => <span key={e} className="w-7 h-7 flex items-center justify-center text-sm rounded border cursor-pointer" style={{ borderColor: "#1a1f2e" }}>{e}</span>)}
          <span className="px-3 py-1.5 rounded text-[10px] font-bold border cursor-pointer" style={{ color: "#7EE787", borderColor: "#238636", background: "rgba(35,134,54,0.1)" }}>SEND</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES_TABS = [
  {
    id: "security", label: "SECURITY", color: "#7EE787", accent: "#238636",
    desc: "Every DM wrapped in RSA-OAEP + AES-GCM hybrid encryption. Your private key never touches the server.",
    items: ["RSA-4096 key pairs per user", "AES-256-GCM message encryption", "Keys stored in localStorage only", "JWT + HttpOnly cookie sessions", "Email-verified password reset"],
  },
  {
    id: "ai", label: "AI ENGINE", color: "#ADC6FF", accent: "#1a2a4a",
    desc: "LLaMA-70B powered assistant built into every chat. Code review, logic explanation, and a free chat panel.",
    items: ["Auto-detect code blocks", "RUN_AI_REVIEW · DEBUG_MY_CODE", "EXPLAIN_LOGIC · OPEN_IN_EDITOR", "Right-click context AI on any message", "Free AI chat panel in sidebar"],
  },
  {
    id: "media", label: "MEDIA", color: "#a78bfa", accent: "#4c1d95",
    desc: "Voice messages, file sharing up to 15MB, drag-and-drop uploads with captions and inline image previews.",
    items: ["Hold-to-record voice messages", "Drag & drop file upload", "Images render inline in chat", "PDFs + files as clickable links", "Caption support on all media"],
  },
  {
    id: "realtime", label: "REAL-TIME", color: "#58A6FF", accent: "#1a3a6e",
    desc: "Socket.io-powered delivery with typing indicators, delivery ticks, and live group member management.",
    items: ["Sub-50ms Socket.io delivery", "Typing indicators per user", "Sending → sent → delivered → seen", "Delete for everyone", "Online/offline presence"],
  },
];

function FeatureTabs() {
  const [active, setActive] = useState(0);
  const [ref, inView] = useInView();
  const tab = FEATURES_TABS[active];

  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(32px)", transition: "all 0.8s cubic-bezier(.16,1,.3,1)" }}>
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {FEATURES_TABS.map((f, i) => (
          <button key={f.id} onClick={() => setActive(i)}
            className="px-5 py-2 text-[11px] font-bold tracking-widest rounded-full border transition-all duration-300"
            style={{
              color: i === active ? f.color : "#484F58",
              borderColor: i === active ? f.color : "#1a1f2e",
              background: i === active ? `${f.color}14` : "transparent",
              transform: i === active ? "scale(1.04)" : "scale(1)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div key={tab.id} style={{ animation: "fadeTab 0.4s ease" }}>
          <div className="text-[10px] tracking-[3px] mb-3 font-bold" style={{ color: tab.color }}>// {tab.id.toUpperCase()}</div>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "#8B949E" }}>{tab.desc}</p>
          <ul className="space-y-3">
            {tab.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px]" style={{ color: "#C9D1D9" }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tab.color }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border p-6" style={{ borderColor: tab.accent, background: `${tab.color}06` }}>
          <div className="text-[10px] tracking-[2px] mb-4" style={{ color: tab.color }}>$ {tab.id} --status</div>
          <div className="space-y-2.5">
            {tab.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: `${tab.accent}88`, background: "#07090c" }}>
                <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: `${tab.color}22`, color: tab.color }}>✓</div>
                <span className="text-[12px]" style={{ color: "#8B949E" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const STACK = [
  { name: "Next.js 16", detail: "App router, RSC, Turbopack", color: "#ffffff" },
  { name: "TypeScript", detail: "Fully typed end-to-end", color: "#3178c6" },
  { name: "MongoDB", detail: "Atlas cloud, Mongoose ODM", color: "#47a248" },
  { name: "Socket.io", detail: "Real-time bidirectional events", color: "#010101" },
  { name: "UploadThing", detail: "CDN-backed file hosting", color: "#c23c3c" },
  { name: "AWS EC2", detail: "Ubuntu, Nginx reverse proxy", color: "#ff9900" },
  { name: "Groq API", detail: "LLaMA-70B inference", color: "#f55036" },
  { name: "Fira Code", detail: "Monospace UI typeface", color: "#7EE787" },
];

export default function Home() {
  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const full = "REVCHAT";
    let i = 0;
    const t = setInterval(() => { setTyped(full.slice(0, ++i)); if (i >= full.length) clearInterval(t); }, 110);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCursor(v => !v), 530);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090c] text-[#C9D1D9] overflow-x-hidden" style={{ fontFamily: "'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Fira Code', monospace !important; box-sizing: border-box; }
        @keyframes glow { 0%,100%{text-shadow:0 0 20px rgba(126,231,135,0.15)} 50%{text-shadow:0 0 60px rgba(126,231,135,0.5),0 0 120px rgba(126,231,135,0.15)} }
        @keyframes fadeTab { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:none} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes scanLine { 0%{top:0%} 100%{top:100%} }
        @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        .glow { animation: glow 4s ease-in-out infinite; }
        .pulse-dot { animation: pulseDot 2s ease infinite; }
        .float { animation: floatY 6s ease-in-out infinite; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #07090c; }
        ::-webkit-scrollbar-thumb { background: #1a2035; }
        pre { white-space: pre-wrap; word-break: break-word; }
        .grain::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:1; opacity:0.025; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
      `}</style>

      <MatrixRain />
      <div className="grain" />

      {/* Radial ambient */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(88,166,255,0.05) 0%, transparent 60%)" }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-12 py-4 border-b" style={{ borderColor: "rgba(26,31,46,0.8)", background: "rgba(7,9,12,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] tracking-widest ml-1" style={{ color: "#484F58" }}>revchat@secure ~ %</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-[10px] tracking-widest" style={{ color: "#30363d" }}>
          {["SECURITY", "AI ENGINE", "MEDIA", "STACK"].map(s => (
            <a key={s} href={`#${s.toLowerCase().replace(" ", "-")}`} className="hover:text-[#7EE787] transition-colors">{s}</a>
          ))}
        </div>
        <Link href="/login" className="px-5 py-2 text-[11px] font-bold tracking-widest rounded-lg border transition-all hover:scale-105" style={{ color: "#7EE787", borderColor: "#238636", background: "rgba(35,134,54,0.1)" }}>
          LOGIN →
        </Link>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-20 text-center">
        {/* Parallax grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(88,166,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          transform: `translateY(${scrollY * 0.15}px)`,
        }} />

        <div style={{ opacity: 1 }}>
          {/* Status pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border mb-8" style={{ borderColor: "#1a2a4a", background: "rgba(88,166,255,0.06)" }}>
          </div>

          {/* Main heading */}
          <div className="float">
            <h1 className="font-bold leading-none tracking-tighter glow mb-0 select-none" style={{ color: "#7EE787", fontSize: "clamp(72px, 14vw, 160px)", letterSpacing: "-4px" }}>
              {typed}<span style={{ opacity: cursor ? 1 : 0, transition: "opacity 0.1s" }}>_</span>
            </h1>
          </div>

          <div className="mt-4 mb-2 text-[11px] tracking-[6px]" style={{ color: "#1e3a2a" }}>
            DEVELOPER-FIRST · END-TO-END ENCRYPTED · AI-POWERED
          </div>

          {/* Subheading */}
          <p className="mt-8 max-w-lg mx-auto text-sm leading-relaxed" style={{ color: "#8B949E" }}>
            A terminal-aesthetic chat application built for developers.<br />
            RSA-OAEP encryption, Socket.io real-time, LLaMA-70B AI,<br />
            voice messages, and file sharing — all in one dark interface.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 justify-center">
            <Link href="/login" className="group inline-flex items-center gap-3 px-10 py-4 text-sm font-bold tracking-widest rounded-xl transition-all hover:scale-105" style={{ background: "#7EE787", color: "#07090c", boxShadow: "0 0 40px rgba(126,231,135,0.25)" }}>
              INITIALIZE SESSION
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <a href="#demo" className="inline-flex items-center gap-3 px-10 py-4 text-sm tracking-widest rounded-xl border transition-all hover:scale-105" style={{ color: "#58A6FF", borderColor: "#1a3a6e", background: "rgba(88,166,255,0.05)" }}>
              WATCH DEMO ↓
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-xl mx-auto">
            {[
              { v: "RSA-4096", l: "ENCRYPTION" },
              { v: "<50ms", l: "LATENCY" },
              { v: "15MB", l: "FILE LIMIT" },
              { v: "70B", l: "AI PARAMS" },
            ].map(({ v, l }) => (
              <div key={l} className="flex flex-col items-center gap-1 p-3 rounded-xl border" style={{ borderColor: "#1a1f2e", background: "rgba(255,255,255,0.01)" }}>
                <span className="text-lg font-bold" style={{ color: "#58A6FF" }}>{v}</span>
                <span className="text-[9px] tracking-widest" style={{ color: "#484F58" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 flex flex-col items-center gap-2" style={{ animation: "floatY 2s ease-in-out infinite" }}>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#1a2a4a] to-transparent" />
          <span className="text-[9px] tracking-[3px]" style={{ color: "#30363d" }}>SCROLL</span>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="relative z-10 px-6 sm:px-12 py-28 max-w-6xl mx-auto">
        <Reveal className="text-center mb-14">
          <div className="text-[10px] tracking-[3px] mb-3" style={{ color: "#484F58" }}>// LIVE_DEMO</div>
          <h2 className="text-4xl font-bold mb-3" style={{ color: "#C9D1D9" }}>See it in action</h2>
          <p className="text-sm" style={{ color: "#484F58" }}>Watch AI code review happen in real-time. This animation replays every time you scroll to it.</p>
        </Reveal>
        <Reveal delay={0.15}>
          <LiveChat />
        </Reveal>
      </section>

      {/* Feature tabs */}
      <section id="security" className="relative z-10 px-6 sm:px-12 py-24 border-y" style={{ borderColor: "#1a1f2e", background: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="text-[10px] tracking-[3px] mb-3" style={{ color: "#484F58" }}>// CAPABILITIES</div>
            <h2 className="text-4xl font-bold" style={{ color: "#C9D1D9" }}>Everything you need</h2>
          </Reveal>
          <FeatureTabs />
        </div>
      </section>

      {/* Code typing demo */}
      <section className="relative z-10 px-6 sm:px-12 py-28 max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <div className="text-[10px] tracking-[3px] mb-3" style={{ color: "#484F58" }}>// CODE_IN_CHAT</div>
          <h2 className="text-4xl font-bold mb-3" style={{ color: "#C9D1D9" }}>Built for developers</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "#484F58" }}>Wrap code in triple backticks with a language name. RevChat auto-detects, syntax-highlights, and shows AI action buttons.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { step: "01", title: "Type your code", code: "```js\nfunction greet(name) {\n  return `hello ${name}`;\n}", color: "#7EE787" },
              { step: "02", title: "Gets highlighted", code: "Auto-detects language\nSyntax highlighting\nLine numbers rendered", color: "#58A6FF" },
              { step: "03", title: "AI reviews it", code: "→ RUN_AI_REVIEW\n→ EXPLAIN_LOGIC\n→ OPEN_IN_EDITOR", color: "#ADC6FF" },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border overflow-hidden" style={{ borderColor: "#1a2a4a", background: "#060b14" }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#1a2a4a", background: "#040810" }}>
                  <span className="text-[9px] tracking-widest font-bold" style={{ color: s.color }}>STEP_{s.step}</span>
                  <span className="text-[10px]" style={{ color: "#3d5a8a" }}>{s.title}</span>
                </div>
                <pre className="p-4 text-[11px] leading-relaxed" style={{ color: s.color }}>{s.code}</pre>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Social features */}
      <section className="relative z-10 px-6 sm:px-12 py-24 border-t" style={{ borderColor: "#1a1f2e" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="text-[10px] tracking-[3px] mb-3" style={{ color: "#484F58" }}>// SOCIAL</div>
            <h2 className="text-4xl font-bold" style={{ color: "#C9D1D9" }}>Built for teams</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { t: "Friend system", d: "Send, accept, decline, cancel requests", c: "#7EE787", i: "👥" },
              { t: "User discovery", d: "Search by username to find developers", c: "#58A6FF", i: "🔍" },
              { t: "Online presence", d: "Real-time online/offline indicators", c: "#7EE787", i: "🟢" },
              { t: "Group channels", d: "Create & manage groups with member roles", c: "#a78bfa", i: "📢" },
              { t: "Toast notifications", d: "Background message alerts, click to jump", c: "#58A6FF", i: "🔔" },
              { t: "Mobile responsive", d: "Full-screen panels, swipe navigation", c: "#ADC6FF", i: "📱" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="p-5 rounded-2xl border h-full transition-all duration-300 hover:scale-[1.02] hover:border-opacity-100 cursor-default"
                  style={{ borderColor: "#1a1f2e", background: "#0a0c10" }}>
                  <div className="text-2xl mb-3">{item.i}</div>
                  <div className="text-sm font-semibold mb-1.5" style={{ color: item.c }}>{item.t}</div>
                  <div className="text-[12px] leading-relaxed" style={{ color: "#484F58" }}>{item.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="relative z-10 px-6 sm:px-12 py-24 border-t" style={{ borderColor: "#1a1f2e", background: "rgba(255,255,255,0.01)" }}>
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-14">
            <div className="text-[10px] tracking-[3px] mb-3" style={{ color: "#484F58" }}>// TECH_STACK</div>
            <h2 className="text-4xl font-bold" style={{ color: "#C9D1D9" }}>Infrastructure</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STACK.map((s, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="p-4 rounded-2xl border transition-all hover:scale-[1.03]" style={{ borderColor: "#1a1f2e", background: "#0a0c10" }}>
                  <div className="text-sm font-bold mb-1" style={{ color: s.color === "#ffffff" ? "#C9D1D9" : s.color }}>{s.name}</div>
                  <div className="text-[11px]" style={{ color: "#484F58" }}>{s.detail}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-36 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(126,231,135,0.05) 0%, transparent 70%)" }} />
        <Reveal>
          <div className="max-w-lg mx-auto relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8" style={{ borderColor: "#238636", background: "rgba(35,134,54,0.08)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#7EE787] pulse-dot" />
              <span className="text-[10px] tracking-[2px]" style={{ color: "#7EE787" }}>SERVERS ONLINE · ACCEPTING CONNECTIONS</span>
            </div>
            <h2 className="text-6xl font-bold glow mb-5" style={{ color: "#7EE787", letterSpacing: "-2px" }}>Start now.</h2>
            <p className="text-sm mb-10 leading-relaxed" style={{ color: "#484F58" }}>
              Every message encrypted. Every file protected.<br />Every conversation private. No compromises.
            </p>
            <Link href="/login" className="inline-flex items-center gap-4 px-12 py-5 text-base font-bold tracking-widest rounded-xl transition-all hover:scale-105"
              style={{ background: "#7EE787", color: "#07090c", boxShadow: "0 0 60px rgba(126,231,135,0.3)" }}>
              INITIALIZE SESSION →
            </Link>
            <div className="mt-5 text-[11px]" style={{ color: "#1e2d42" }}>
              No account?{" "}
              <Link href="/login" className="underline" style={{ color: "#238636" }}>Register in seconds →</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "#1a1f2e" }}>
        <div className="text-[10px] tracking-widest" style={{ color: "#30363d" }}>RevChat v1.1</div>
        <div className="flex items-center gap-2 text-[10px] tracking-widest" style={{ color: "#30363d" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-[#7EE787] pulse-dot" />
          E2EE by default · Socket.io · AWS EC2 · LLaMA-70B
        </div>
        <div className="text-[10px] tracking-widest" style={{ color: "#30363d" }}>Built with Next.js 16</div>
      </footer>
    </div>
  );
}
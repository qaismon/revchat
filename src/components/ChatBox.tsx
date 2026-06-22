"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from "emoji-picker-react";
import CodeReviewer from "./CodeReviewer";
import VoiceMessage from "./VoiceMessage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import MatrixRain from "./chatBackgrounds/MatrixRain";
import ParticlesBg from "./chatBackgrounds/Particlesbg";
import NeuralBg from "./chatBackgrounds/NeuralBg";
import AskAIModal from "./AskAIModal";
import FreeAIChat from "./FreeAIChat";
import AIMessage from "./AIMessage";
import { ParticleBurst } from "./ParticleBurst";
import { useSound } from "@/hooks/useSound";
import { themes } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bytes = atob(s);
  const buf = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
  return view;
}

async function importPublicKey(pem: string) {
  return window.crypto.subtle.importKey("spki", fromB64(pem), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}
async function importPrivateKey(pem: string) {
  return window.crypto.subtle.importKey("pkcs8", fromB64(pem), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}

function TickIcon({ status }: { status: "sending" | "sent" | "delivered" | "seen" }) {
  if (status === "sending") return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><circle cx="12" cy="12" r="9" strokeDasharray="3 3"/></svg>;
  if (status === "sent") return <svg width="14" height="10" viewBox="0 0 16 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (status === "delivered") return <svg width="18" height="10" viewBox="0 0 20 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="6,5 10,9 19,1" stroke="#484F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg width="18" height="10" viewBox="0 0 20 10" fill="none"><polyline points="1,5 5,9 14,1" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="6,5 10,9 19,1" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function getMessageStatus(m: any): "sending"|"sent"|"delivered"|"seen" {
  if (m.seen) return "seen";
  if (m.delivered) return "delivered";
  if (m._id?.startsWith("msg-")) return "sending";
  return "sent";
}

function FileMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const packetLine = lines[0];
  const caption = lines.slice(1).join("\n").trim();
  const raw = packetLine.replace("FILE_PACKET:", "");
  const parts = raw.split("|");
  const url = parts[0] ?? ""; const name = parts[1] ?? "file"; const type = parts[2] ?? "";

  if (type.startsWith("image/")) {
    return (
      <div className="group/img relative">
        <img src={url} alt={name} onClick={() => window.open(url, "_blank")}
          className="rounded-xl border cursor-pointer block object-cover transition-all hover:brightness-110"
          style={{ width:"240px", height:"auto", maxWidth:"100%", borderColor:"#1a2035" }}/>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none rounded-xl" style={{background:"rgba(0,0,0,0.3)"}}>
          <span className="text-[10px] text-white px-2 py-1 rounded-lg" style={{background:"rgba(0,0,0,0.6)"}}>open ↗</span>
        </div>
        <span className="text-[10px] text-[#484F58] mt-1 block">{name}</span>
        {caption && <span className="text-[13px] text-[#C9D1D9] mt-1 block">{caption}</span>}
      </div>
    );
  }
  const isPDF = type === "application/pdf";
  return (
    <div style={{width:"240px"}}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all hover:border-[#58A6FF44] group/file"
        style={{background:"#07090c", borderColor:"#1a2035"}} onClick={() => window.open(url, "_blank")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{background: isPDF ? "#f8514918":"#58A6FF18"}}>
          {isPDF
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium truncate transition-colors" style={{color: isPDF?"#f85149":"#58A6FF"}}>{name}</div>
          <div className="text-[10px] text-[#484F58]">{isPDF?"PDF":"File"} · click to open</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#484F58" strokeWidth="2" className="shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </div>
      {caption && <div className="text-[13px] text-[#C9D1D9] mt-1.5 px-1">{caption}</div>}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0,1,2].map(i=>(
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#7EE787]"
          style={{animation:`typingBounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>
      ))}
    </div>
  );
}

export default function ChatBox({ userId, peerId, onBack, onStartCall }: { userId: string; peerId: string; onBack?: () => void; onStartCall?: (peerId: string, peerName: string) => void }) {
  const socketRef = useSocket(userId);
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [theme, setTheme] = useState<ThemeId>("matrix");
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement|null>(null);
  const textareaRef = useRef<HTMLTextAreaElement|null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout|null>(null);
  const [peerName, setPeerName] = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  const [peerPublicKey, setPeerPublicKey] = useState<string|null>(null);
  const [peerKeyStatus, setPeerKeyStatus] = useState<"loading"|"ready"|"missing">("loading");
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string,string>>({});
  const [grepQuery, setGrepQuery] = useState("");
  const [isGrepActive, setIsGrepActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { isRecording, recordingTime, startRecording, stopRecording } = useAudioRecorder();

  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState({ id:"", code:"", comments:"" });
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState<{id:string;text:string;sender:string}|null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedFile, setDraggedFile] = useState<File|null>(null);
  const [dragPreviewUrl, setDragPreviewUrl] = useState<string|null>(null);
  const [dragCaption, setDragCaption] = useState("");
  const [aiContextMenu, setAiContextMenu] = useState<{x:number;y:number;msgId:string;content:string}|null>(null);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string|null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [flippingIds, setFlippingIds] = useState<Set<string>>(new Set());
  const [burst, setBurst] = useState<{id:number;x:number;y:number}|null>(null);
  const { playSend, playReceive } = useSound();
  const myPubKeyRef = useRef<string | null>(null);
  const myPubKeyPromise = useRef<Promise<string> | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const burstIdRef = useRef(0);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const triggerBurst = useCallback(() => {
    const btn = sendBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    burstIdRef.current++;
    setBurst({id: burstIdRef.current, x: rect.left + rect.width/2, y: rect.top + rect.height/2});
    setTimeout(() => setBurst(null), 800);
  }, []);

  const fmtRec = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  function ReplyMessage({ content }: { content: string }) {
    const raw = content.replace("REPLY_PACKET:", "");
    const sepIdx = raw.lastIndexOf("|");
    const quoted = raw.substring(0, sepIdx);
    const actual = raw.substring(sepIdx + 1);
    return (
      <div>
        <div className="border-l-2 border-[#58A6FF] pl-2 mb-1.5 opacity-60 text-xs text-[#8B949E] truncate max-w-full">
          {quoted.startsWith("FILE_PACKET:") ? "[file]" : quoted.startsWith("AUDIO_PACKET:") ? "[voice]" : quoted.split("\n")[0].substring(0,60)}
        </div>
        {actual.startsWith("FILE_PACKET:") ? <FileMessage content={actual}/> : <CodeReviewer text={actual}/>}
      </div>
    );
  }

  const handleFileSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 15*1024*1024) { alert("FILE_TOO_LARGE: Max 15MB"); if (fileInputRef.current) fileInputRef.current.value=""; return; }
    setIsUploadingFile(true); setUploadProgress(0);
    try {
      const fd = new FormData(); fd.append("file", file);
      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded/e.total*100)); };
        xhr.onload = async () => { const d = JSON.parse(xhr.responseText); if (xhr.status>=200&&xhr.status<300&&d.url) await sendMessage(`FILE_PACKET:${d.url}|${file.name}|${file.type}`); resolve(); };
        xhr.onerror = () => resolve(); xhr.open("POST","/api/upload-file"); xhr.send(fd);
      });
    } catch(err) { console.error(err); }
    finally { setIsUploadingFile(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value=""; }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0]; if (!file) return;
    if (file.size>15*1024*1024) { alert("FILE_TOO_LARGE"); return; }
    setDraggedFile(file);
    if (file.type.startsWith("image/")) setDragPreviewUrl(URL.createObjectURL(file)); else setDragPreviewUrl(null);
  };

  const handleDragPreviewSend = async () => {
    if (!draggedFile) return;
    setIsUploadingFile(true); setUploadProgress(0); setDraggedFile(null); setDragPreviewUrl(null);
    try {
      const fd = new FormData(); fd.append("file", draggedFile);
      const cap = dragCaption.trim(); setDragCaption("");
      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded/e.total*100)); };
        xhr.onload = async () => { const d = JSON.parse(xhr.responseText); if (xhr.status>=200&&xhr.status<300&&d.url) { const p=`FILE_PACKET:${d.url}|${draggedFile.name}|${draggedFile.type}`; await sendMessage(cap?`${p}\n${cap}`:p); } resolve(); };
        xhr.onerror = () => resolve(); xhr.open("POST","/api/upload-file"); xhr.send(fd);
      });
    } catch(err) { console.error(err); }
    finally { setIsUploadingFile(false); setUploadProgress(0); }
  };

  const requestAIDescription = async (msgId: string, rawCode: string) => {
    try {
      const clean = rawCode.replace(/### 🧠 LOGIC_EXPLAINED/g,"").replace(/\[SYSTEM_DIAGNOSTIC_REPORT\].*/g,"").trim();
      if (!clean||clean.includes("Analyzing logic flow")) return;
      const aid = `ai-desc-${Date.now()}`; const lt="Analyzing...";
      setMessages(prev=>[...prev,{_id:aid,senderId:"AI_BOT",content:lt,createdAt:new Date().toISOString()}]);
      setDecryptedMessages(prev=>({...prev,[aid]:lt}));
      const res = await fetch("/api/ai/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:clean,mode:"DESCRIBE"})});
      const data = await res.json();
      setMessages(prev=>prev.filter(m=>m._id!==aid));
      if (data.suggestion) await sendMessage(`### 🧠 LOGIC_EXPLAINED\n\n${data.suggestion}`);
    } catch(err) { console.error(err); }
  };

  const requestAIReview = async (msgId: string, rawCode: string) => {
    try {
      const aid = `ai-${Date.now()}`;
      setMessages(prev=>[...prev,{_id:aid,senderId:"AI_BOT",content:"Analyzing...",createdAt:new Date().toISOString()}]);
      setDecryptedMessages(prev=>({...prev,[aid]:"Analyzing..."}));
      const res = await fetch("/api/ai/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:rawCode})});
      const data = await res.json();
      setMessages(prev=>prev.filter(m=>m._id!==aid));
      await sendMessage(`[AI CODE REVIEW]\n\n${data.suggestion}`);
    } catch(err) { console.error(err); }
  };

 const handleVoiceSend = async () => {
  const blob = await stopRecording();
  if (!blob) return;
  setIsUploadingVoice(true);
  try {
const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });    
const fd = new FormData();
    fd.append("file", file);
    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d.url);
        else reject(new Error(d.error || "Upload failed"));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.open("POST", "/api/upload-voice");
      xhr.send(fd);
    });
    await sendMessage(`AUDIO_PACKET:${url}`);
  } catch (err) {
    console.error("Voice upload error:", err);
  } finally {
    setIsUploadingVoice(false);
    setUploadProgress(0);
  }
};

  const handleDeleteMessage = async (msgId: string) => {
    setConfirmDeleteId(null);
    setFlippingIds(prev => new Set(prev).add(msgId));
    try {
      await Promise.all([
        fetch(`/api/messages/${msgId}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})}).then(r=>{if(!r.ok)throw new Error("delete failed");}),
        new Promise(r => setTimeout(r, 480)),
      ]);
      setMessages(prev=>prev.map(m=>m._id===msgId?{...m,deleted:true}:m));
      setDecryptedMessages(prev=>{const n={...prev};delete n[msgId];return n;});
      socketRef.current?.emit("delete-message",{messageId:msgId,peerId});
    } catch(err) { console.error(err); }
    finally { setFlippingIds(prev => { const n=new Set(prev); n.delete(msgId); return n; }); }
  };

  const scrollToBottom = useCallback(()=>{if(!isGrepActive)messagesEndRef.current?.scrollIntoView({behavior:"smooth"});},[isGrepActive]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0 || !userId || !peerId) return;
    setIsLoadingMore(true);
    const el = messagesContainerRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    try {
      const oldest = messages[0];
      const before = oldest?.createdAt;
      if (!before) { setHasMore(false); setIsLoadingMore(false); return; }
      const res = await fetch(`/api/messages?user1=${userId}&user2=${peerId}&limit=30&before=${encodeURIComponent(before)}`);
      const data = await res.json();
      const older = Array.isArray(data) ? data : (data.messages || []);
      if (older.length === 0) { setHasMore(false); setIsLoadingMore(false); return; }
      const existingIds = new Set(messages.map((m: any) => m._id));
      const deduped = older.filter((m: any) => !existingIds.has(m._id));
      setMessages(prev => [...deduped, ...prev]);
      setHasMore(Array.isArray(data) ? false : (data.hasMore ?? false));
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } catch (err) { console.error(err); }
    finally { setIsLoadingMore(false); }
  }, [userId, peerId, messages, hasMore, isLoadingMore]);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || isLoadingMore || !hasMore) return;
    if (el.scrollTop < 80) loadMore();
  }, [loadMore, isLoadingMore, hasMore]);
  useEffect(()=>{
    if (!isGrepActive) {
      const el = messagesContainerRef.current;
      if (!el) { messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); return; }
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
    }
  },[messages,isPeerTyping,decryptedMessages,isGrepActive]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages]);

  useEffect(()=>{
    const load = async () => {
      if (!userId||!peerId) return;
      try {
        const res = await fetch(`/api/messages?user1=${userId}&user2=${peerId}&limit=30`);
        const data = await res.json();
        const msgs = Array.isArray(data) ? data : (data.messages || []);
        setMessages(msgs);
        setHasMore(Array.isArray(data) ? false : (data.hasMore ?? false));
        setMsgCount(msgs.length);
        socketRef.current?.emit("seen-messages",{senderId:peerId,receiverId:userId});
        const ur = await fetch(`/api/users/${peerId}`);
        const ud = await ur.json();
        setPeerName(ud.username); setPeerAvatar(ud.avatar); setPeerPublicKey(ud.publicKey);
        setPeerKeyStatus(ud.publicKey ? "ready" : "missing");
      } catch(err) { console.error(err); }
    };
    load();
  },[userId,peerId,socketRef]);

  useEffect(()=>{
    const decryptAll = async () => {
      const prk = localStorage.getItem(`privKey_${userId}`);
      if (!prk||messages.length===0) return;
      try {
        const privKey = await importPrivateKey(prk);
        const nd={...decryptedMessages}; let upd=false;
        for (const m of messages) {
          const mid=m._id||m.createdAt; if(nd[mid]) continue;
          try {
            if(m.deleted) continue;
            const isMe=m.senderId===userId; const raw=isMe?m.contentSender:m.content;
            if(m.senderId==="AI_BOT"){nd[mid]=m.content;upd=true;continue;}
            if(!raw){if(new Date().getTime()-new Date(m.createdAt).getTime()<2000)continue;nd[mid]=isMe?"[History Unavailable]":"[Encrypted Packet]";upd=true;continue;}
            const {ct,iv,wk}=JSON.parse(raw);
            const wkb=fromB64(wk);
            const aesk=await window.crypto.subtle.decrypt({name:"RSA-OAEP"},privKey,wkb);
            const aesKey=await window.crypto.subtle.importKey("raw",aesk,{name:"AES-GCM"},true,["decrypt"]);
            const dec=await window.crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(iv)},aesKey,fromB64(ct));
            nd[mid]=new TextDecoder().decode(dec);upd=true;
          } catch(e){console.error(e);nd[m._id||m.createdAt]="[ERROR: DECRYPTION_FAILED]";upd=true;}
        }
        if(upd) setDecryptedMessages(nd);
      } catch(err){console.error(err);}
    };
    decryptAll();
  },[messages,userId]);

  useEffect(()=>{
    const socket=socketRef.current; if(!socket) return;
    const hMsg=(msg:any)=>{
      const isCallLog=msg.type==="call_log";
      const rel=isCallLog
        ? msg.senderId===peerId||msg.receiverId===userId
        : (msg.senderId===userId&&msg.receiverId===peerId)||(msg.senderId===peerId&&msg.receiverId===userId);
      if(rel){if(!isCallLog&&msg.senderId===userId)return;setMessages(p=>p.some(m=>m._id===msg._id||m._id===msg.messageId)?p:[...p,{...msg,content:msg.content||msg.message,_id:msg._id||`temp-${Date.now()}`}]);setMsgCount(c=>c+1);if(!isCallLog)playReceive();if(!isCallLog&&msg.senderId===peerId)socket.emit("seen-messages",{senderId:peerId,receiverId:userId});}
    };
    const hSeen=({seenBy}:{seenBy:string})=>{if(seenBy===peerId)setMessages(p=>p.map(m=>m.senderId===userId?{...m,seen:true,delivered:true}:m));};
    const hTyping=({from,isTyping}:{from:string;isTyping:boolean})=>{if(from===peerId)setIsPeerTyping(isTyping);};
    const hDel=({to,from}:{to:string;from:string})=>{if(from===userId&&to===peerId)setMessages(p=>p.map(m=>m.senderId===userId&&!m.seen?{...m,delivered:true}:m));};
    const hMsgDel=({messageId}:{messageId:string})=>{setMessages(p=>p.map(m=>m._id===messageId?{...m,deleted:true}:m));setDecryptedMessages(p=>{const n={...p};delete n[messageId];return n;});};
    socket.on("message-deleted",hMsgDel);socket.on("receive-message",hMsg);socket.on("messages-seen",hSeen);socket.on("display-typing",hTyping);socket.on("message-delivered",hDel);
    return()=>{socket.off("message-delivered",hDel);socket.off("message-deleted",hMsgDel);socket.off("receive-message",hMsg);socket.off("messages-seen",hSeen);socket.off("display-typing",hTyping);};
  },[userId,peerId,socketRef]);

  const handleInputChange=(e:React.ChangeEvent<HTMLTextAreaElement|HTMLInputElement>)=>{
    setText(e.target.value);
    socketRef.current?.emit("typing",{to:peerId,from:userId,isTyping:true});
    if(typingTimeoutRef.current)clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current=setTimeout(()=>{socketRef.current?.emit("typing",{to:peerId,from:userId,isTyping:false});},2000);
  };

  const [sendError, setSendError] = useState("");

  const sendMessage = async (overrideContent?: string) => {
    const base=overrideContent||text;
    if(!base.trim()) return;
    if(!peerPublicKey) { setSendError("Cannot send: peer encryption keys not available"); return; }
    setSendError("");
    const qt=replyingTo?.text.startsWith("REPLY_PACKET:")?replyingTo.text.substring(replyingTo.text.lastIndexOf("|")+1):replyingTo?.text??"";
    const cts=replyingTo?`REPLY_PACKET:${qt}|${base}`:base;
    setReplyingTo(null);
    if(typingTimeoutRef.current)clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit("typing",{to:peerId,from:userId,isTyping:false});
    try {
      const raw=cts; if(!overrideContent)setText("");
      const aesKey=await window.crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
      const iv=window.crypto.getRandomValues(new Uint8Array(12));
      const enc=await window.crypto.subtle.encrypt({name:"AES-GCM",iv},aesKey,new TextEncoder().encode(raw));
      const expk=await window.crypto.subtle.exportKey("raw",aesKey);
      const pp=await importPublicKey(peerPublicKey);
      if (!myPubKeyRef.current) {
        if (!myPubKeyPromise.current) {
          myPubKeyPromise.current = fetch(`/api/users/${userId}`).then(r=>r.json()).then(d=>{myPubKeyRef.current=d.publicKey;return d.publicKey;});
        }
        await myPubKeyPromise.current;
      }
      const mp=await importPublicKey(myPubKeyRef.current!);
      const [wkp,wkm]=await Promise.all([
        window.crypto.subtle.encrypt({name:"RSA-OAEP"},pp,expk),
        window.crypto.subtle.encrypt({name:"RSA-OAEP"},mp,expk),
      ]);
      const b64=(b:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(b)));
      const pkgP=JSON.stringify({ct:b64(enc),iv:btoa(String.fromCharCode(...iv)),wk:b64(wkp)});
      const pkgM=JSON.stringify({ct:b64(enc),iv:btoa(String.fromCharCode(...iv)),wk:b64(wkm)});
      const tid=`msg-${Date.now()}`;
      setMessages(p=>[...p,{_id:tid,senderId:userId,receiverId:peerId,content:pkgP,contentSender:pkgM,createdAt:new Date().toISOString(),delivered:false,seen:false}]);
      setDecryptedMessages(p=>({...p,[tid]:raw}));
      setMsgCount(c=>c+1);
      socketRef.current?.emit("send-message",{to:peerId,message:pkgP,senderId:userId});
      playSend();
      fetch("/api/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({senderId:userId,receiverId:peerId,content:pkgP,contentSender:pkgM})}).then(async dbR=>{if(!dbR.ok)throw new Error("DB save failed");const sv=await dbR.json();if(sv?._id){setMessages(p=>p.map(m=>m._id===tid?{...m,_id:sv._id}:m));setDecryptedMessages(p=>{const n:Record<string,string>={...p,[sv._id]:raw};delete n[tid];return n;});}}).catch(err=>{console.error("DB save failed",err);setSendError("Message failed to save");});
    } catch(err){console.error("Hybrid Transmission failed",err);setSendError("Message failed to send");}
  };

  const displayedMessages=isGrepActive?messages.filter(m=>(decryptedMessages[m._id||m.createdAt]||"").toLowerCase().includes(grepQuery.toLowerCase())):messages;
  const onEmojiClick=(ed:any)=>{setText(p=>p+ed.emoji);setShowEmojiPicker(false);};
  const themeKeys: ThemeId[] = ["matrix", "neon", "amber", "cyan"];
  const nextTheme = (t: ThemeId): ThemeId => themeKeys[(themeKeys.indexOf(t) + 1) % themeKeys.length];

  const grouped: Record<string, any[]> = displayedMessages.reduce((acc,m)=>{
    const d=new Date(m.createdAt||Date.now()).toDateString();
    if(!acc[d])acc[d]=[];acc[d].push(m);return acc;
  },{} as Record<string,any[]>);

  const fmtDate=(d:string)=>{
    const today=new Date().toDateString();
    const yest=new Date(Date.now()-86400000).toDateString();
    if(d===today)return"TODAY";if(d===yest)return"YESTERDAY";
    return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" style={{background:"#07090c",fontFamily:"'Fira Code',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600;700&display=swap');
        .cb,.cb *{font-family:'Fira Code',monospace!important}
        .cs::-webkit-scrollbar{width:3px}.cs::-webkit-scrollbar-track{background:transparent}.cs::-webkit-scrollbar-thumb{background:#1a2035;border-radius:2px}
        @keyframes msgIn{from{opacity:0;transform:translateY(5px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes glitchIn{0%{opacity:0;clip-path:inset(0 0 100% 0)}20%{opacity:1;clip-path:inset(0 0 60% 0);transform:translateX(-2px)}40%{clip-path:inset(40% 0 30% 0);transform:translateX(2px)}60%{clip-path:inset(20% 0 50% 0);transform:translateX(-1px)}80%{clip-path:inset(0 0 0 0);transform:translateX(0)}100%{clip-path:inset(0 0 0 0);opacity:1}}
        @keyframes crtLine{0%{top:-2px}100%{top:100%}}
        @keyframes flipOut{0%{transform:perspective(600px) rotateY(0)}50%{transform:perspective(600px) rotateY(90deg) translateX(10px)}100%{transform:perspective(600px) rotateY(180deg) translateX(60px);opacity:0}}
        @keyframes glitchOut{0%{opacity:1;filter:blur(0)}20%{transform:translateX(-4px) skewX(2deg);filter:blur(1px)}40%{transform:translateX(4px) skewX(-2deg);filter:blur(2px)}60%{transform:translateX(-2px);filter:blur(3px)}100%{opacity:0;filter:blur(8px);transform:translateX(40px)}}
        @keyframes typeIn{from{max-width:0}to{max-width:100%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
        @keyframes prog{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 1px #1a2a4a}50%{box-shadow:0 0 16px rgba(88,166,255,0.12),0 0 0 1px #1a3a6e}}
        @keyframes voice-pulse{0%,100%{box-shadow:0 0 0 0 rgba(35,134,54,0.4)}50%{box-shadow:0 0 12px 2px rgba(35,134,54,0.6)}}
        .msg-in{animation:msgIn .22s cubic-bezier(.16,1,.3,1) forwards,glitchIn .35s ease-out forwards;position:relative;max-width:100%}
        .msg-in::after{content:"";position:absolute;left:0;right:0;height:1px;background:repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(126,231,135,0.03) 1px,rgba(126,231,135,0.03) 2px);animation:crtLine 3s linear infinite;pointer-events:none;opacity:0.4}
        .msg-flip-out{animation:flipOut .45s cubic-bezier(.55,0,.1,1) forwards,glitchOut .45s ease-out forwards!important;pointer-events:none;max-width:100%}
        .fu{animation:fadeUp .2s ease-out}
        .si{animation:slideIn .28s cubic-bezier(.16,1,.3,1) forwards}
        .ai-glow{animation:glow 3s ease-in-out infinite}
        .btn{transition:all .15s ease}.btn:hover{transform:translateY(-1px)}.btn:active{transform:scale(.93)}
        .inp:focus-within{box-shadow:0 0 0 1px #1a3a6e,0 0 20px rgba(88,166,255,0.05)}
        .prog-bar{background:linear-gradient(90deg,#0a0c10 25%,#1a3a6e 50%,#0a0c10 75%);background-size:200% 100%;animation:prog 1.5s infinite}
        .reaction-float{animation:floatUp .35s cubic-bezier(.34,1.56,.64,1) forwards}
        @keyframes floatUp{from{opacity:0;transform:translateY(6px) scale(.5)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      {/* HEADER */}
      <div className="cb shrink-0 z-20 relative" style={{background:"rgba(9,11,15,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid #0f1520"}}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button onClick={onBack} className="md:hidden btn w-8 h-8 rounded-xl flex items-center justify-center text-[#484F58] hover:text-[#C9D1D9] hover:bg-white/5 mr-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl overflow-hidden" style={{border:"1px solid #1a2035"}}>
                {peerAvatar
                  ?<img src={peerAvatar} className="w-full h-full object-cover" alt=""/>
                  :<div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{background:"#1a2035",color:"#58A6FF"}}>{peerName?.[0]?.toUpperCase()||"?"}</div>
                }
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{background:"#07090c",padding:"2px"}}>
                <div className="w-full h-full rounded-full bg-[#7EE787]"/>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#E6EDF3] truncate">{peerName?.toLowerCase()||"user"}</span>
              </div>
              <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{color:isPeerTyping?"#7EE787":"#30363d"}}>
                {isPeerTyping?(
                  <>
                    <span>typing</span>
                    <span className="flex gap-0.5">{[0,1,2].map(i=><span key={i} className="inline-block w-1 h-1 rounded-full bg-[#7EE787]" style={{animation:`typingBounce 1.2s ease-in-out ${i*.2}s infinite`}}/>)}</span>
                  </>
                ):""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onStartCall&&(
              <button onClick={()=>onStartCall(peerId, peerName)} className="btn w-8 h-8 rounded-lg flex items-center justify-center" style={{color:"#7EE787",border:"1px solid #23863633",background:"rgba(126,231,135,0.06)"}} title="Voice call">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </button>
            )}
            <button onClick={()=>setShowFreeAI(true)} className="btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider" style={{color:"#58A6FF",border:"1px solid #1a2a4a",background:"rgba(88,166,255,0.06)"}}>
              AI
            </button>
            <button onClick={()=>setTheme(t=>nextTheme(t))} className="btn px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider" style={{color:themes[theme].accent,border:`1px solid ${themes[theme].accent}33`,background:`${themes[theme].accent}08`}}>
              {themes[theme].name}
            </button>
            <button onClick={()=>{setIsGrepActive(!isGrepActive);setGrepQuery("");}} className="btn w-8 h-8 rounded-lg flex items-center justify-center" style={{color:isGrepActive?"#7EE787":"#484F58",border:`1px solid ${isGrepActive?"#238636":"#1a1f2e"}`,background:isGrepActive?"#0d2218":"transparent"}}>
              {isGrepActive
                ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
            </button>
          </div>
        </div>

        {isGrepActive&&(
          <div className="fu px-4 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{background:"#0a0c10",border:"1px solid #1a3a6e"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7EE787" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span className="text-[10px] font-bold text-[#7EE787] mr-1">grep</span>
              <input autoFocus value={grepQuery} onChange={e=>setGrepQuery(e.target.value)} placeholder="search messages..." className="flex-1 bg-transparent border-none outline-none text-[#C9D1D9] text-xs"/>
              {grepQuery&&<span className="text-[10px] text-[#484F58]">{displayedMessages.length} found</span>}
            </div>
          </div>
        )}

        {(isUploadingFile||isUploadingVoice)&&(
          <div className="h-0.5" style={{background:"#0a0c10"}}>
            <div className="h-full transition-all" style={{width:`${uploadProgress}%`,background:"linear-gradient(90deg,#238636,#7EE787)"}}/>
          </div>
        )}
      </div>

      {/* MESSAGES */}
      <div className="flex-1 relative overflow-hidden" onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>
        {dragOver&&(
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3" style={{background:"rgba(7,9,12,0.94)",border:"2px dashed #58A6FF"}}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </div>
            <div className="text-[#58A6FF] text-sm font-bold tracking-widest">DROP TO UPLOAD</div>
            <div className="text-[10px] text-[#484F58]">any file up to 15MB</div>
          </div>
        )}
        {theme === "neon" && <ParticlesBg color="#a78bfa" bgColor="#090610"/>}
        {theme === "matrix" && <MatrixRain color="#7EE787" bgColor="#07090c"/>}
        {theme === "amber" && <MatrixRain color="#FFB000" bgColor="#080600"/>}
        {theme === "cyan" && <NeuralBg color="#58A6FF" highlight="#00D4FF" bgColor="#000a12"/>}
        <div className="absolute inset-0 pointer-events-none z-0" style={{background:`radial-gradient(ellipse 70% 50% at 50% 100%,${themes[theme].accent}08 0%,transparent 70%)`}}/>

        <div className="cb cs relative z-[1] h-full overflow-y-auto overflow-x-hidden px-4 py-4 flex flex-col gap-0.5" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
          {isLoadingMore && (
            <div className="py-3 flex items-center justify-center gap-2 shrink-0">
              <div style={{width:14,height:14,border:"1.5px solid #30363D",borderTopColor:"#7EE787",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>
              <span className="text-[10px] text-[#484F58]">loading older messages...</span>
            </div>
          )}
          {hasMore && !isLoadingMore && messages.length > 0 && (
            <div className="py-2 flex justify-center shrink-0">
              <span className="text-[9px] text-[#30363D]">scroll up to load more</span>
            </div>
          )}
          {displayedMessages.length===0&&!isGrepActive&&(
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:"#0a0c10",border:"1px solid #1a1f2e"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-[#C9D1D9] mb-1">Start the conversation</div>
                <div className="text-[11px] text-[#484F58]">End-to-end encrypted · RSA-OAEP + AES-GCM</div>
              </div>
            </div>
          )}
          {displayedMessages.length===0&&isGrepActive&&(
            <div className="text-center py-12 text-[11px] text-[#484F58]">no results for <span className="text-[#7EE787]">"{grepQuery}"</span></div>
          )}

          {Object.entries(grouped).map(([date,msgs])=>(
            <div key={date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{background:"#0f1520"}}/>
                <span className="text-[9px] font-bold tracking-widest px-2.5 py-1 rounded-full" style={{color:"#30363d",background:"#0a0c10",border:"1px solid #0f1520"}}>{fmtDate(date)}</span>
                <div className="flex-1 h-px" style={{background:"#0f1520"}}/>
              </div>
              {msgs.map((m,mi)=>{
                const isMe=m.senderId===userId;
                const mid=m._id||m.createdAt;
                const dc=decryptedMessages[mid]||"Decrypting...";
                const isAI=m.senderId==="AI_BOT"||dc.startsWith("### 🧠 LOGIC_EXPLAINED");
                const isAudio=!m.deleted&&dc.startsWith("AUDIO_PACKET:");
                const isFile=!m.deleted&&dc.startsWith("FILE_PACKET:");
                const prev=msgs[mi-1];
                const sameGrp=prev&&prev.senderId===m.senderId&&!isAI;
                const isFlipping = flippingIds.has(mid);
                return (
                  <div key={mid} className={`flex ${isAI?"justify-center":isMe?"justify-end":"justify-start"} ${sameGrp?"mt-0.5":"mt-3"} ${isFlipping?"msg-flip-out":"msg-in"}`}>
                    <div className="relative group" style={{maxWidth: isAI ? "min(95vw,580px)" : (dc.includes("```") ? "min(92vw,600px)" : "min(82vw,360px)"),overflowWrap:"break-word"}}>
                      {/* {!isMe&&!isAI&&!sameGrp&&(
                        <div className="absolute -left-8 bottom-0 w-6 h-6 rounded-xl overflow-hidden" style={{border:"1px solid #1a2035"}}>
                          {peerAvatar?<img src={peerAvatar} className="w-full h-full object-cover" alt=""/>:<div className="w-full h-full flex items-center justify-center text-[9px] font-bold" style={{background:"#1a2035",color:"#58A6FF"}}>{peerName?.[0]?.toUpperCase()}</div>}
                        </div>
                      )} */}
                      {!isAI&&!m.deleted&&confirmDeleteId!==mid&&(
                        <div className={`absolute top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isMe?"-left-16":"-right-16"}`}>
                          <button onClick={()=>{setReplyingTo({id:mid,text:dc,sender:isMe?"you":peerName});setTimeout(()=>textareaRef.current?.focus(),50);}}
                            className="btn w-7 h-7 rounded-xl flex items-center justify-center" style={{background:"#0a0c10",border:"1px solid #1a1f2e",color:"#8B949E"}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                          </button>
                          {isMe&&(
                            <button onClick={()=>setConfirmDeleteId(confirmDeleteId===mid?null:mid)}
                              className="btn w-7 h-7 rounded-xl flex items-center justify-center" style={{background:"#1a0a0a",border:"1px solid #3a1010",color:"#f85149"}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          )}
                        </div>
                      )}
                      <div onContextMenu={e=>{e.preventDefault();e.stopPropagation();setAiContextMenu({x:e.clientX,y:e.clientY,msgId:mid,content:dc});}}
                        className={`relative ${isAI?"ai-glow":""}`}
                        style={{
                          ...(isAI?{background:"#060b14",border:"1px solid #1a2a4a",padding:"14px 16px",borderRadius:"18px"}
                            :isAudio||isFile?{background:isMe?"rgba(13,30,20,0.95)":"rgba(10,14,22,0.95)",border:`1px solid ${isMe?"#1a4a2a":"#1a2035"}`,padding:"8px",borderRadius:isMe?"18px 4px 18px 18px":"4px 18px 18px 18px"}
                            :{background:isMe?"rgba(13,28,19,0.97)":"rgba(10,13,21,0.97)",border:`1px solid ${isMe?"#1a4a2a":"#1a2035"}`,padding:"10px 14px",borderRadius:isMe?"18px 4px 18px 18px":"4px 18px 18px 18px"}),
                        }}>
                        {isAI&&(
                          <div className="flex items-center gap-2 mb-3 pb-2.5" style={{borderBottom:"1px solid #0f1829"}}>
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                            </div>
                            <span className="text-[9px] font-bold tracking-[2px] text-[#58A6FF]">NEURAL ENGINE</span>
                            <span className="ml-auto text-[9px] text-[#3d5a8a]">LLaMA-70B</span>
                          </div>
                        )}
                        <div className="text-sm text-[#C9D1D9]">
                          {!m.type&&!isAI&&!isAudio&&!isFile&&!m.deleted&&(
                            <span className="mr-1.5 font-bold text-[11px]" style={{color:isMe?"#7EE787":"#58A6FF"}}>{isMe?">":"$"}</span>
                          )}
                          {m.type==="call_log"?<span className="text-xs text-[#484F58] italic">{m.content}</span>
                            :m.deleted?<span className="italic text-xs text-[#30363d]">// message deleted</span>
                            :isAI?<AIMessage content={dc}/>
                            :isAudio?<VoiceMessage src={dc.replace("AUDIO_PACKET:","")}/>
                            :isFile?<FileMessage content={dc}/>
                            :dc.startsWith("REPLY_PACKET:")?<ReplyMessage content={dc}/>
                            :<CodeReviewer text={dc}/>}
                        </div>
                        {!m.deleted&&dc.includes("```")&&!isAI&&(
                          <div className="flex gap-1.5 mt-2.5 pt-2.5 flex-wrap" style={{borderTop:"1px solid #0f1520"}}>
                            <button onClick={()=>requestAIReview(mid,dc)} className="btn text-[9px] px-2.5 py-1 rounded-lg border font-bold tracking-wider" style={{color:isMe?"#58A6FF":"#7EE787",borderColor:isMe?"#1a3a6e":"#1a4a2a",background:isMe?"#0a1628":"#0d2218"}}>{isMe?"DEBUG":"AI REVIEW"}</button>
                            <button onClick={()=>requestAIDescription(mid,dc)} className="btn text-[9px] px-2.5 py-1 rounded-lg border font-bold tracking-wider" style={{color:"#ADC6FF",borderColor:"#1a2a4a",background:"#060b14"}}>EXPLAIN</button>
                            {!isMe&&<button onClick={()=>{setReviewData({id:mid,code:dc.replace(/###SENIOR_REVIEW\n\n/g,""),comments:""});setIsReviewMode(true);}} className="btn text-[9px] px-2.5 py-1 rounded-lg border font-bold tracking-wider" style={{color:"#f1e05a",borderColor:"#2a2000",background:"#1a1500"}}>EDIT</button>}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-1.5">
                          <span className="text-[9px] text-[#30363d]">{new Date(m.createdAt||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                          {isMe&&!isAI&&<TickIcon status={getMessageStatus(m)}/>}
                        </div>
                        {confirmDeleteId===mid&&!m.deleted&&(
                          <div className="flex items-center gap-2 pt-2 mt-2" style={{borderTop:"1px solid #3a1010"}}>
                            <span className="text-[9px] font-bold tracking-wider text-[#f85149]">DELETE?</span>
                            <button onClick={()=>handleDeleteMessage(mid)} className="btn text-[9px] px-2.5 py-1 rounded-lg font-bold" style={{background:"#f8514918",color:"#f85149",border:"1px solid #3a1010"}}>YES</button>
                            <button onClick={()=>setConfirmDeleteId(null)} className="btn text-[9px] px-2.5 py-1 rounded-lg" style={{background:"#0a0c10",color:"#8B949E",border:"1px solid #1a1f2e"}}>NO</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {isPeerTyping&&(
            <div className="flex justify-start mt-3 msg-in">
              <div className="rounded-2xl rounded-tl-sm" style={{background:"rgba(10,14,22,0.95)",border:"1px solid #1a2035"}}>
                <TypingDots/>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-1"/>
        </div>
      </div>

      {/* EDITOR */}
      {isReviewMode&&(
        <div className="cb shrink-0 mx-3 rounded-t-2xl overflow-hidden z-10" style={{background:"#0a0c10",border:"1px solid #2a2000",borderBottom:"none"}}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{borderColor:"#1a1800",background:"#0f0e00"}}>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#f1e05a]"/><span className="text-[10px] font-bold tracking-widest text-[#f1e05a]">EDITOR · PATCH MODE</span></div>
            <button onClick={()=>setIsReviewMode(false)} className="btn w-6 h-6 rounded-lg flex items-center justify-center text-[#f85149] hover:bg-[#f8514911]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="p-3 grid gap-2.5">
            <div>
              <div className="text-[9px] font-bold tracking-widest mb-1.5 text-[#484F58]">SOURCE CODE</div>
              <textarea className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-y min-h-[90px] outline-none" style={{background:"#07090c",color:"#7EE787",border:"1px solid #1a1800",fontFamily:"'Fira Code',monospace"}} value={reviewData.code} onChange={e=>setReviewData({...reviewData,code:e.target.value})} spellCheck={false}/>
            </div>
            <div>
              <div className="text-[9px] font-bold tracking-widest mb-1.5 text-[#484F58]">MENTOR NOTES</div>
              <textarea placeholder="Explain your changes..." className="w-full rounded-xl px-3 py-2.5 text-[12px] resize-none min-h-[44px] outline-none" style={{background:"#07090c",color:"#C9D1D9",border:"1px solid #1a1800",fontFamily:"'Fira Code',monospace"}} value={reviewData.comments} onChange={e=>setReviewData({...reviewData,comments:e.target.value})}/>
            </div>
            <button onClick={async()=>{
              const fc=reviewData.code.includes("```")?reviewData.code:`\`\`\`\n${reviewData.code}\n\`\`\``;
              const fr=reviewData.comments.trim()?`### SENIOR_PATCH\n\n${fc}\n\n---\n**NOTES:** ${reviewData.comments}`:`### SENIOR_PATCH\n\n${fc}`;
              await sendMessage(fr);setIsReviewMode(false);
            }} className="btn w-full py-2.5 rounded-xl text-[11px] font-bold tracking-widest" style={{background:"#f1e05a14",color:"#f1e05a",border:"1px solid #2a2000"}}>
              COMMIT PATCH →
            </button>
          </div>
        </div>
      )}

      {/* DRAG MODAL */}
      {draggedFile&&(
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{background:"rgba(7,9,12,0.92)",backdropFilter:"blur(8px)"}}>
          <div className="w-80 rounded-2xl overflow-hidden si" style={{background:"#0a0c10",border:"1px solid #1a2035"}}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:"#0f1520"}}>
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span className="text-[11px] font-bold tracking-wider text-[#58A6FF]">ATTACH FILE</span>
              </div>
              <button onClick={()=>{setDraggedFile(null);setDragPreviewUrl(null);setDragCaption("");}} className="btn w-6 h-6 rounded-lg flex items-center justify-center text-[#f85149] hover:bg-[#f8514911]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {dragPreviewUrl
                ?<img src={dragPreviewUrl} alt="preview" className="w-full rounded-xl object-contain" style={{maxHeight:"200px",border:"1px solid #1a2035"}}/>
                :<div className="py-8 flex flex-col items-center gap-3 rounded-xl" style={{background:"#07090c",border:"1px solid #0f1520"}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-[#C9D1D9] break-all px-4">{draggedFile.name}</div>
                    <div className="text-[10px] text-[#484F58] mt-1">{(draggedFile.size/1024).toFixed(1)} KB</div>
                  </div>
                </div>
              }
              <input autoFocus placeholder="Add a caption (optional)..." value={dragCaption} onChange={e=>setDragCaption(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")handleDragPreviewSend();if(e.key==="Escape"){setDraggedFile(null);setDragPreviewUrl(null);setDragCaption("");}}}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{background:"#07090c",border:"1px solid #1a2035",color:"#C9D1D9",fontFamily:"'Fira Code',monospace"}}/>
              <button onClick={handleDragPreviewSend} className="btn w-full py-3 rounded-xl text-[11px] font-bold tracking-widest" style={{background:"#0d2218",color:"#7EE787",border:"1px solid #238636"}}>
                SEND FILE →
              </button>
            </div>
          </div>
        </div>
      )}

      <FreeAIChat open={showFreeAI} onClose={()=>setShowFreeAI(false)} onSendToChat={sendMessage}/>
      <AskAIModal contextMenu={aiContextMenu} onCloseContextMenu={()=>setAiContextMenu(null)} onSendToChat={sendMessage}/>

      {/* INPUT */}
      <div className="cb shrink-0 z-20 px-3 pb-3 pt-2 relative" style={{background:"rgba(7,9,12,0.98)",borderTop:"1px solid #0f1520"}}>
        {replyingTo&&(
          <div className="fu flex items-center gap-3 mb-2 px-3 py-2 rounded-xl" style={{background:"#0a0c10",borderLeft:"2px solid #58A6FF"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            <span className="text-[11px] flex-1 truncate text-[#8B949E]">
              replying: <span className="text-[#C9D1D9]">{replyingTo.text.startsWith("FILE_PACKET:")?"[file]":replyingTo.text.startsWith("AUDIO_PACKET:")?"[voice]":replyingTo.text.split("\n")[0].substring(0,45)}</span>
            </span>
            <button onClick={()=>setReplyingTo(null)} className="text-[#484F58] hover:text-[#f85149] transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {text.includes("```")&&(
          <div className="fu mb-2 px-3 py-2 rounded-xl" style={{background:"#07090c",border:"1px dashed #1a4a2a"}}>
            <div className="text-[9px] font-bold tracking-widest mb-2 text-[#238636]">// CODE PREVIEW</div>
            <CodeReviewer text={text}/>
          </div>
        )}

        {peerKeyStatus === "missing" && (
          <div className="mb-2 px-3 py-2 rounded-xl flex items-center gap-2" style={{background:"#1a0a0a",border:"1px solid #3a1010"}}>
            <span className="text-[10px] text-[#f85149]">⚠ Peer has no encryption keys — cannot send encrypted messages</span>
          </div>
        )}
        {peerKeyStatus === "loading" && (
          <div className="mb-2 px-3 py-2 rounded-xl flex items-center gap-2" style={{background:"#0a1628",border:"1px solid #1a3a6e"}}>
            <div style={{width:10,height:10,border:"1px solid #30363D",borderTopColor:"#58A6FF",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>
            <span className="text-[10px] text-[#58A6FF]">loading encryption keys...</span>
          </div>
        )}
        {sendError && (
          <div className="mb-2 px-3 py-1.5 rounded-xl flex items-center gap-2" style={{background:"#1a0a0a",border:"1px solid #3a1010"}}>
            <span className="text-[10px] text-[#f85149]">✖ {sendError}</span>
          </div>
        )}

        <div className="inp flex items-end gap-2 px-3 py-2 rounded-2xl transition-all" style={{background:"#0a0c10",border:"1px solid #1a1f2e"}}>
          <span className="text-sm font-bold mb-2 shrink-0 select-none text-[#7EE787]">$</span>
          <textarea ref={textareaRef} rows={Math.min(text.split("\n").length,4)}
            className="flex-1 bg-transparent border-none outline-none text-sm resize-none py-2 px-1"
            style={{color:"#C9D1D9",fontFamily:"'Fira Code',monospace",minHeight:"20px",maxHeight:"96px"}}
            value={text} onChange={handleInputChange}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();triggerBurst();}}}
            placeholder="type a message..."/>

          {showEmojiPicker&&(
            <div className="absolute bottom-full right-3 mb-3 z-[1000] rounded-2xl overflow-hidden" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
              <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} skinTonesDisabled searchPlaceholder="search emoji..." width={300} height={380}/>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0 mb-1">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,*/*" className="hidden" onChange={handleFileSend}/>
            <button onClick={()=>fileInputRef.current?.click()} disabled={isUploadingFile} className="btn w-8 h-8 rounded-xl flex items-center justify-center" style={{color:isUploadingFile?"#58A6FF":"#484F58",border:`1px solid ${isUploadingFile?"#1a3a6e":"transparent"}`,background:isUploadingFile?"#0a1628":"transparent"}} title="Attach file">
              {isUploadingFile?<span className="text-[9px] font-bold text-[#58A6FF]">{uploadProgress}%</span>:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}
            </button>
            <button onClick={()=>setShowEmojiPicker(!showEmojiPicker)} className="btn w-8 h-8 rounded-xl flex items-center justify-center" style={{color:showEmojiPicker?"#caac03":"#484F58",border:`1px solid ${showEmojiPicker?"#caac03":"transparent"}`,background:showEmojiPicker?"#1a1500":"transparent"}} title="Emoji">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            {isRecording ? (
              <button
                onClick={handleVoiceSend}
                disabled={isUploadingVoice}
                className="btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all"
                style={{
                  background: "#0f2e1a",
                  color: "#7EE787",
                  border: "1px solid #238636",
                  animation: "voice-pulse 1.5s ease-in-out infinite",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                {fmtRec(recordingTime)}
              </button>
            ) : (
              <button
                onClick={async () => { const ok = await startRecording(); if (!ok) console.warn("Mic access denied"); }}
                disabled={isUploadingVoice}
                className="btn w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  color: isUploadingVoice ? "#58A6FF" : "#484F58",
                  border: isUploadingVoice ? "1px solid #1a3a6e" : "transparent",
                  background: isUploadingVoice ? "#0a1628" : "transparent",
                }}
                title="Record voice"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            )}
            <button ref={sendBtnRef} onClick={(e)=>{sendMessage();triggerBurst();}} disabled={!!isRecording || !text.trim()} className="btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider ml-1 transition-colors" style={{background:(!isRecording && text.trim())?"#0f2e1a":"#0a0c10",color:(!isRecording && text.trim())?"#7EE787":"#30363d",border:`1px solid ${(!isRecording && text.trim())?"#238636":"#1a1f2e"}`}}>
              SEND <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7EE787]" style={{animation:"typingBounce 2s ease-in-out infinite"}}/>
            <span className="text-[9px] tracking-wider text-[#30363d]">E2EE ACTIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px]" style={{color:text.length>450?"#f85149":"#30363d"}}>{text.length}/500</span>
            <span className="text-[9px] text-[#30363d] hidden sm:block">↵ send · ⇧↵ newline</span>
          </div>
        </div>
      </div>

      <ParticleBurst burst={burst} />
    </div>
  );
}
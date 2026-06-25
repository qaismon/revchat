# RevChat — Interview Q&A

> A comprehensive guide covering architecture, design decisions, and technical
> deep-dives for the RevChat project. Use this to prepare for system design,
> behavioral, and code-specific interview questions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [WebSocket & Real-Time Messaging](#3-websocket--real-time-messaging)
4. [End-to-End Encryption](#4-end-to-end-encryption)
5. [Voice Calls (WebRTC)](#5-voice-calls-webrtc)
6. [AI Code Review (Groq)](#6-ai-code-review-groq)
7. [Performance & Load Testing](#7-performance--load-testing)
8. [Security & Auth](#8-security--auth)
9. [Deployment & CI/CD](#9-deployment--cicd)
10. [Database & MongoDB](#10-database--mongodb)
11. [Design Trade-offs & Edge Cases](#11-design-trade-offs--edge-cases)
12. [Behavioral & Soft-Skill Questions](#12-behavioral--soft-skill-questions)

---

## 1. Project Overview

### Q: What is RevChat, and what problem does it solve?

RevChat is a real-time developer collaboration platform with three core
offerings:

1. **Messaging** — peer-to-peer encrypted chat with typing indicators, read
   receipts, file/voice sharing, and message deletion.
2. **AI Code Review** — paste any code snippet and get structured feedback
   (bugs, security issues, improvements, revised code) from a Groq-powered LLM
   in under 2 seconds.
3. **Voice Calls** — peer-to-peer voice calls over WebRTC with mute, call
   timer, and persistent call-history logs.

It solves the pain point of context-switching between chat, code review tools,
and voice calls for remote developer teams.

### Q: What technologies did you use and why?

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 16 + React 19 | SSR/SSG flexibility, file-based routing, large ecosystem |
| Backend (API) | Next.js API routes (App Router) | Co-located with frontend, same server process |
| Real-time | Socket.io (WebSocket transport) | Automatic reconnection, fallback to polling, room-based broadcasting |
| Database | MongoDB + Mongoose | Flexible schema for message statuses, fast document queries |
| AI | Groq SDK (Llama 3.3 70B) | Sub-2s inference on structured code review prompts |
| Voice | WebRTC (native browser API) | Peer-to-peer, no media server cost, low latency |
| Auth | JWT (jsonwebtoken) + bcrypt | Stateless auth, fast verification, no session store |
| Encryption | Web Crypto API (RSA-OAEP + AES-GCM) | Browser-native, no third-party crypto library needed |
| File Upload | UploadThing (S3-compatible) | No storage infrastructure to manage |
| Emails | Nodemailer | Password reset flow |
| Styling | Tailwind CSS v4 | Utility-first, fast prototyping |
| CI/CD | GitHub Actions | TypeScript check + production build on every push |

---

## 2. System Architecture

### Q: Walk me through the architecture. How do the pieces fit together?

```
┌─────────────┐       ┌──────────────────────────────────────┐
│  Browser A   │──────▶│  Next.js Server (Node.js + HTTP)    │
│  (React 19)  │       │                                      │
│              │       │  ┌──────────────┐  ┌──────────────┐  │
│  Socket.io   │       │  │ API Routes   │  │ Socket.io    │  │
│  Client      │◀─────▶│  │ (/api/...)   │  │ Server       │  │
│              │       │  └──────┬───────┘  └──────┬───────┘  │
└─────────────┘       │         │                  │          │
                      │         ▼                  ▼          │
┌─────────────┐       │  ┌──────────────────────────────┐     │
│  Browser B   │──────▶│  │        MongoDB               │     │
│  (React 19)  │       │  │  (Messages, Users, Groups)   │     │
│              │       │  └──────────────────────────────┘     │
│  WebRTC      │       └──────────────────────────────────────┘
│  Peer        │◀═══════════════════════════════════════════════▶
│  Connection  │    (Direct P2P audio via STUN server)
└─────────────┘
```

1. Both browsers connect to the **Next.js server** via HTTP (API) and WebSocket
   (Socket.io).
2. **API routes** handle CRUD (messages, users, groups, auth) and AI code
   review — they connect to MongoDB for persistence.
3. **Socket.io** handles real-time events: message delivery, typing indicators,
   read receipts, and voice-call signaling.
4. **WebRTC** establishes a direct P2P audio channel once signaling completes
   over Socket.io — media never touches the server.

### Q: Why does the Socket.io server live inside Next.js (custom server) instead of a separate process?

The project uses a **custom Next.js server** (`server.js` based on the
recommended approach) where Socket.io is mounted on the same HTTP server that
handles Next.js requests. This avoids:

- Cross-origin CORS issues between separate frontend/backend domains
- Two separate deployments
- Extra network hop for signaling

For production at scale, you'd separate them — but for a real-time app with
<100 concurrent users, co-location keeps deployment simple and latency low.

---

## 3. WebSocket & Real-Time Messaging

### Q: Explain Socket.io integration. What events did you implement?

The Socket.io server (`server.js`) handles ~15 events across 5 categories:

**Connection lifecycle:**
- `join` — user comes online, added to `onlineUsers` map, broadcast online list
  to all peers
- `disconnect` — user leaves, removed from `onlineUsers`, broadcast updated list

**Direct messaging:**
- `send-message` → `receive-message` — relay encrypted message to recipient
  (and sender for delivery status)
- `message-delivered` — notifies sender when delivery succeeds
- `seen-messages` → `messages-seen` — read receipts

**Typing:**
- `typing` → `display-typing` — debounced typing indicator

**Group chat:**
- `join-group` — joins a Socket.io room scoped by group ID
- `send-group-message` → `receive-group-message`
- `group-typing` → `group-display-typing`
- `trigger-group-update` — propagate group edits/deletes

**Voice call signaling (8 events):**
- `call-offer` → `incoming-call`
- `call-answer` → `call-answered`
- `ice-candidate` → `ice-candidate`
- `call-end` → `call-ended`
- `call-decline` → `call-declined`
- `call-mute` → `call-muted`
- `call-log` — persists call history to MongoDB, relays `receive-message`

### Q: How do delivery receipts (sent/delivered/seen) work?

1. **Sent** — the message appears in the UI with the optimistic `"msg-xxx"` ID.
2. **Delivered** — the server checks `onlineUsers.has(to)` at send time. If the
   recipient is online, the server emits `message-delivered` back to the sender
   and also makes a `PATCH /api/messages/status` call to persist `delivered:
   true` to MongoDB.
3. **Seen** — when the recipient opens the chat, the client emits
   `seen-messages`. The server broadcasts `messages-seen` to the sender and
   persists `seen: true` in the database.

The UI renders a 4-state TickIcon component: spinning circle (sending), single
check (sent), double check (delivered), blue double check (seen).

### Q: How is message pagination implemented?

`GET /api/messages?user1=X&user2=Y&limit=30&before=<ISO timestamp>`

- On mount, the latest 30 messages are fetched (sorted by `createdAt`
  descending, then reversed to chronological order).
- When scrolling up to a trigger point, a second request with `before` set to
  the oldest message's `createdAt` fetches the next page.
- The response includes `hasMore: boolean` so the client knows when to stop.
- Paginated deleted messages are handled: the `deleted` field is included in
  `.select()` and the client skips deleted messages via `if (m.deleted)
  continue;`. Items marked `[History Unavailable]` in previous sessions are now
  properly excluded.

---

## 4. End-to-End Encryption

### Q: How did you implement E2E encryption? What algorithm did you use?

The encryption scheme is **hybrid RSA-AES**, implemented entirely with the
browser native **Web Crypto API** (no third-party crypto library):

**Key generation (`src/lib/crypto.ts`):**
- Each user generates an RSA-OAEP 2048-bit key pair on registration/encryption
  enablement.
- The public key is uploaded to the server (`publicKey` field on User model).
- The private key is encrypted with an AES-GCM key derived from the user's
  password hash and stored server-side as `encryptedPrivateKey`.

**Sending a message:**
1. Generate a random AES-256-GCM key (for bulk encryption).
2. Encrypt the plaintext message with AES-GCM.
3. Encrypt the AES key with the recipient's RSA-2048 public key.
4. Send both as `content` (AES ciphertext) and `contentSender` (encrypted AES
   key). The server never sees plaintext.

**Receiving a message:**
1. Decrypt `contentSender` with your RSA private key → recover the AES key.
2. Decrypt `content` with the AES key → recover plaintext.

### Q: How do users recover their private keys on a new device?

The private key is stored **server-side** as `encryptedPrivateKey`, which is
the RSA private key encrypted with an AES key derived from the user's password.
When the user logs in on a new device:

1. Client sends the password.
2. Client derives the AES key from the password (PBKDF2 or similar).
3. Client fetches `encryptedPrivateKey` from the server.
4. Client decrypts it with the derived AES key → recovers RSA private key.
5. The private key is held in memory only — never persisted to localStorage.

This means encryption is portable across devices without a separate key backup
phrase.

### Q: Why RSA-OAEP instead of ECDH or X25519?

RSA-OAEP is the most widely supported asymmetric encryption algorithm in
`SubtleCrypto` across all browsers, offering excellent compatibility
(Chrome, Firefox, Safari, Edge). While ECDH would give smaller ciphertexts
and faster performance, RSA-OAEP with 2048-bit keys provides adequate security
for a chat application and avoids key agreement complexity (ECDH requires
ephemeral keys + signing, adding another layer).

However, ECDH would be preferred in a production re-write for: smaller
ciphertext overhead, faster encryption/decryption, and forward secrecy when
combined with ephemeral keys.

---

## 5. Voice Calls (WebRTC)

### Q: Explain your WebRTC implementation. What STUN/TURN server did you use?

Uses Google's public STUN server (`stun:stun.l.google.com:19302`). **No TURN
server** — the project operates under the assumption that most developer
workstations are on NAT configurations where STUN-mediated peer-to-peer
connections succeed.

**Call flow:**

1. **Offerer (caller)** clicks phone icon → `startCall(peerId, peerName,
   callerName)` fires.
2. `createPC()` creates an `RTCPeerConnection`, requests `getUserMedia({audio:
   true})`, adds tracks, creates an SDP offer, and sends `call-offer` via
   Socket.io.
3. **Answerer (callee)** receives `incoming-call` event → shows incoming
   overlay with caller's name.
4. On Accept → `answerCall()` creates its own `RTCPeerConnection`, sets the
   offer, creates an answer, sends it back.
5. Both sides exchange ICE candidates as they're gathered.
6. When ICE state reaches `"connected"` or `"completed"`, `setCallState("connected")`
   fires and a 1-second interval timer starts.
7. On End → cleanup: close PC, stop tracks, stop ringtone, emit `call-end`.
8. When `callState` transitions to `"ended"`, the page effect emits `call-log`
   → server persists to MongoDB → call history appears in chat.

### Q: How did you handle the ringtone? Did you use audio files?

No audio files. The ringtone is synthesized using the **Web Audio API**:

- A square-wave oscillator alternates between 440 Hz and 480 Hz every 600ms.
- Pattern: 440 Hz (600ms) → silent (100ms) → 480 Hz (600ms) → silent (500ms).
- Total loop duration: 1.6s, repeated via `setInterval`.
- Volume is capped at `0.08` (8%) to avoid being jarring.
- The `AudioContext` is created lazily in the `playRingtone()` callback, which
  means it requires a user gesture first (standard browser autoplay policy).
- Stopped via `stopRingtone()` which closes the `AudioContext` and clears the
  interval.

### Q: How did you handle the "caller name" bug where it showed the wrong name?

The bug was: `startCall` received `(peerId, peerName)` where `peerName` was
the **callee's** name (from the ChatBox header), but it was being sent as
`userName` in the `call-offer` event. So the callee would see their own name
instead of the caller's.

**Fix:** Added a third parameter `callerName` to `startCall`. The page wraps
the call as `(peerId, peerName, currentUser.username)`. A separate `callerName`
state was added to the `useWebRTC` hook (distinct from `callPeerName`), set
only by `handleIncomingCall` from `data.userName`. The `VoiceCallOverlay` uses
`callerName` for the incoming state and `callPeerName` for the connected/calling
states.

### Q: How did you persist call history so it survives a page refresh?

The `call-log` Socket.io event handler in `server.js`:

1. Formats a duration string: `"Call ended · 03:25"`.
2. POSTs to `/api/messages` with `type: "call_log"` — once for each direction
   (caller→callee and callee→caller).
3. Gets the real MongoDB `_id` from the response.
4. Emits `receive-message` to each participant with the full message object
   (including `_id`).

On page refresh, `GET /api/messages` returns call_log messages like any other
message (the `type` field is included in `.select()`). `ChatBox` renders them
as an italic system-status line instead of a bubble, and `decryptAll` skips
them since they're plain-text, not encrypted.

### Q: How did you fix the 0:00 duration bug in call logs?

The bug was that `setCallDuration(0)` was called inside `cleanup()`, which ran
before the page-level effect (`prevCallStateRef`) could read `callDuration` —
so the effect always saw 0.

**Fix:** Removed `setCallDuration(0)` from `cleanup()`. Added it to:
- The 2.5s timeout that transitions `"ended"` → `"idle"` (runs after the
  effect fires).
- `declineCall()` (for declined calls that never connected).

This ensures the effect reads the real timer value before it's reset.

---

## 6. AI Code Review (Groq)

### Q: Explain how the AI code review feature works.

The endpoint `POST /api/ai/review` accepts `{ code, mode, question, history }`.

**Four modes:**

| Mode | Purpose | Prompt Style |
|---|---|---|
| `REVIEW` | Full code review | Summary → Issues (with fixes) → Improvements → Revised Code |
| `DESCRIBE` | Explain what code does | "What it does" → "Key logic" → "Data flow" → "Security notes" |
| `ASK` | Ask a question about code | Context-aware QA with conversation history |
| `FREE` | General assistant chat | Direct, context-preserving chat |

**Prompt engineering details:**
- `temperature: 0.3` for REVIEW/DESCRIBE (deterministic, factual).
- `temperature: 0.5` for ASK/FREE (slightly more creative).
- `max_tokens: 1500` for REVIEW, `500` for DESCRIBE.
- System prompts explicitly forbid preamble ("Sure!", "Here is"), bullet soup,
  and generic praise.
- Uses **Llama 3.3 70B** (via Groq) for all modes except DESCRIBE uses
  **Llama 3.1 8B** for speed.
- Response typically arrives in **under 2 seconds** due to Groq's LPU
  inference hardware.

### Q: How did you avoid cold-start issues with the Groq SDK during build?

Module-level `new Groq({ apiKey })` threw during `next build` because
`GROQ_API_KEY` was not set in the CI environment.

**Fix:** Lazy initialization:

```typescript
let groq: Groq | null = null;
function getGroq() {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groq;
}
```

The same pattern was applied to `connectDB()` for `MONGODB_URI`. Both env
checks are now inside the function body, not at module scope. This is a general
Next.js build best practice for env-dependent initialization.

---

## 7. Performance & Load Testing

### Q: You claim ~200–500ms response time and ~80–90 req/sec. How did you achieve this?

**Backend optimizations:**
1. **Cached MongoDB connection** — Mongoose connection is cached in a module
   variable (`cached.promise` pattern in `db.ts`). Subsequent calls to
   `connectDB()` reuse the existing connection with zero overhead.
2. **Indexed queries** — `Message.find()` with `$or` on `senderId/receiverId`
   leverages MongoDB indexes. The `createdAt: -1` sort for pagination also uses
   an index.
3. **Lean queries** — `.lean()` on Message queries returns plain JS objects
   instead of Mongoose documents, reducing deserialization overhead.
4. **Selective projection** — `.select("senderId receiverId content ...")`
   fetches only the 8 needed fields instead of the full document.
5. **Capped pagination** — `limit + 1` pattern (fetch one extra, check for
   `hasMore`, pop) avoids a separate `count` query.
6. **Parallel fetch in client** — `Promise.all` for users and groups data
   requests runs both in parallel.

### Q: How did you load-test with k6? What did you learn?

Using k6, I tested the critical API endpoints (message fetch, send, auth) with
ramp-up to 50+ virtual users.

**Key findings:**
- **0% failure rate** on core message endpoints under sustained load.
- **CPU-bound vs IO-bound profiling** — identified that message decryption
  (RSA-OAEP operations) was CPU-bound on the client, while database queries
  were IO-bound on the server.
- The server handled ~80–90 req/sec before CPU contention on the single Node.js
  thread became the bottleneck (this is expected for a co-located Next.js +
  Socket.io server).
- **Recommendation for scale:** split Socket.io into a separate process or use
  Node.js cluster mode across multiple cores.

---

## 8. Security & Auth

### Q: How is authentication implemented?

**JWT-based stateless auth:**
1. User registers → password hashed with bcrypt, stored in MongoDB.
2. User logs in → server verifies password, signs a JWT (`userId`, `exp: 15m`)
   with `JWT_SECRET`, returns it as an HTTP-only cookie (`accessToken`).
3. API routes extract the JWT from cookies via `getUserFromRequest()` in
   `auth.ts`: parse cookie header, find `accessToken=`, verify with `jwt.verify`.
4. Invalid/expired tokens → redirect to `/login`.
5. **Password reset** uses Nodemailer to send a reset link (with a separate
   short-lived token).

### Q: What security measures did you implement?

1. **JWT auth** on all API routes — `getUserFromRequest()` returns `null` if
   the cookie is missing or token is invalid; routes return 401.
2. **IDOR prevention** — each authenticated route verifies the requesting
   user's identity matches the resource owner:
   - `GET /api/messages` — checks `userId === user1 || userId === user2`.
   - `POST /api/messages` — checks `senderId === userId`.
   - `DELETE /api/messages/[id]` — checks `message.senderId === userId`.
3. **Friendship gating** — messages can only be sent between accepted friends
   (`Friendship.findOne({ status: "accepted" })`). Non-friends get 403.
4. **Rate limiting** — in-memory rate limiter (`checkRateLimit` in
   `rate-limit.ts`): 10 requests per IP per 60-second window for sensitive
   endpoints.
5. **NoSQL injection prevention** — all user-supplied IDs are validated by
   Mongoose's `ObjectId` casting; the `before` date parameter is checked with
   `isNaN(new Date(before).getTime())`.
6. **E2E encryption** — server never sees plaintext message content.
7. **HTTP-only cookies** — JWT token is not accessible via JavaScript.

### Q: Why is the rate limiter in-memory? Wouldn't it reset on server restart?

Yes, it's a simple Map-based limiter that resets on restart. For a multi-server
production deployment, you'd replace it with a shared Redis instance. For this
project's scope (single-server, <100 users), the in-memory approach adds zero
infrastructure overhead while still preventing naive abuse.

---

## 9. Deployment & CI/CD

### Q: How did you deploy the application?

Deployed on **AWS EC2** (Ubuntu) with:
- **Nginx** as a reverse proxy (terminates TLS, proxies to Node.js on port
  3000).
- **PM2** for process management (auto-restart on crash, log rotation).
- Rolling updates via git pull + `pm2 restart`.
- MongoDB hosted on MongoDB Atlas (free tier).

### Q: What does the CI/CD pipeline look like?

**GitHub Actions workflow** (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request] → branches: [main, master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - actions/checkout@v4
      - actions/setup-node@v4 with node-version: 22 + npm cache
      - npm ci
      - npx tsc --noEmit       # TypeScript type-check
      - npm run build           # next build (production build)
```

Lint is excluded because `next build` in Next.js 16 doesn't run ESLint by
default, and the pre-existing ESLint warnings (unused vars, `any` types) are
non-blocking. The TypeScript check and successful build are the quality gates.

---

## 10. Database & MongoDB

### Q: What is the Message schema? How did you handle the `call_log` type?

```typescript
{
  type: String,            // undefined (regular) | "call_log"
  senderId: ObjectId,      // ref: User
  receiverId: ObjectId,    // ref: User
  content: String,         // encrypted message OR "Call ended · 03:25"
  contentSender: String,   // encrypted AES key (null for call_log)
  deleted: Boolean,
  delivered: Boolean,
  seen: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

The `type` field was added to distinguish regular encrypted messages from
call-log system messages. The `POST /api/messages` route has an early-return
path: if `type === "call_log"`, it skips auth, friendship checks, and
encryption validation — just saves the document and returns it. This is safe
because this path is only reached via `server.js`'s internal fetch, not from
the client API.

### Q: How did you structure the Friendship and Group schemas?

Friendship tracks the bidirectional relationship:
```typescript
{
  requester: ObjectId,
  recipient: ObjectId,
  status: "pending" | "accepted" | "blocked",
}
```
Queries use `$or` on `[requester, recipient]` to find friendships regardless of
direction.

Group members have role-based access (RBAC): admin, members, with join requests
pending/approved.

---

## 11. Design Trade-offs & Edge Cases

### Q: Why did you put WebRTC state at the page level instead of inside ChatBox?

Calling state lives in `chat/page.tsx` because ChatBox is **unmounted** when
the user switches between chats. If WebRTC state lived inside ChatBox, an
active call would be destroyed when the user navigated to a different
conversation. By lifting state to the page and rendering `VoiceCallOverlay`
above the sidebar, the call persists regardless of which chat is active.

### Q: How do you handle race conditions in WebRTC? For example, what if the user ends a call while getUserMedia is still pending?

The `createPC()` function has a guard:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
if (pc.signalingState === "closed") {
  stream.getTracks().forEach(t => t.stop());
  throw new Error("PC was closed during getUserMedia");
}
```

If `cleanup()` (called by `endCall()`) runs while `getUserMedia` is awaiting,
the PC is closed and `signalingState === "closed"`. The guard catches this,
releases the stream, and throws. The caller (`startCall`/`answerCall`) has a
catch block that resets state to `"idle"`.

### Q: How do you prevent duplicate call-log messages?

Each participant emits `call-log` once when their call state transitions to
`"ended"`. The server `call-log` handler:

1. Saves a message from `from`→`to` and relays it only to `to` (recipient).
2. Saves a message from `to`→`from` and relays it only to `from` (recipient).

Each side thus receives exactly one relayed message (from the other's emit),
resulting in exactly one call-log entry per user per call.

### Q: What happens if both users call each other simultaneously?

This is a known race condition in the current implementation. Both would try
to establish `RTCPeerConnection` instances simultaneously, leading to one of
them receiving a `call-offer` while in the `"calling"` state. Currently, the
later offer would overwrite `pendingOfferRef` and switch the callee's state to
`"incoming"`, creating a conflicting state.

**Production fix:** Add a "busy" signal — if a user is in `"calling"` or
`"connected"` state when an `incoming-call` arrives, emit a `call-busy` event
back to the caller showing "User is busy."

### Q: How did you handle the callback-ref audio playback pattern?

Standard `useRef` + `useEffect` to play the remote stream was unreliable
because the `srcObject` assignment and `.play()` call could race with the
`ontrack` callback. **Callback ref** solves this:

```tsx
<audio ref={(el) => {
  if (el && remoteStream) {
    el.srcObject = remoteStream;
    el.play().catch(console.error);
  }
}} autoPlay playsInline />
```

React guarantees the callback ref is called synchronously when the element
mounts. So even if `remoteStream` is set before the DOM renders, the ref will
fire as soon as the element exists. This entirely avoids the timing race
between stream availability and element existence.

### Q: What about the callback ref not re-running when remoteStream changes?

That's a valid concern — the callback ref runs **once** when the element
mounts, not when props change. However, the `<audio>` element with callback
ref only mounts when `callState === "connected"`, and `remoteStream` is set
by the same `ontrack` event that transitions the state to `"connected"` (via
`oniceconnectionstatechange`). So by the time the `<audio>` mounts,
`remoteStream` is already set. If it weren't, the callback ref would do nothing
(guarded by `if (remoteStream)`), but `ontrack` sets `setRemoteStream` before
the state is read — and React would re-render. However, since the callback
ref wouldn't re-run...

**Better alternative** in production: use a `useEffect` with both `remoteStream`
and the audio element ref as dependencies. But the callback ref works for the
current flow because the timing (remote stream → connected state → audio mount)
is deterministic in practice.

---

## 12. Behavioral & Soft-Skill Questions

### Q: Tell me about a difficult bug you fixed in this project.

One tricky bug was the **duration always showing 0:00 in call logs**. The
`setCallDuration(0)` call was inside `cleanup()`, which ran when the call
ended. The page effect (`prevCallStateRef`) read `callDuration` inside a
`useEffect` triggered by `callState === "ended"`. Due to React's state batching,
`cleanup()` (called from `endCall()`) zeroed the timer before the effect ran.

The fix was conceptually simple but hidden by the fact that the cleanup
function's side effect (zeroing the timer) was invisible at the call site —
you had to trace `endCall() → cleanup() → setCallDuration(0)`. Moving the
reset to the 2.5s timeout (which runs after the effect fires) solved it.

### Q: Why did you choose WebRTC over a media server like LiveKit or Agora?

**Scope.** This is a 1-on-1 chat app, not a conference platform. WebRTC's
native browser API provides peer-to-peer audio at zero infrastructure cost.
A media server like LiveKit (SFU) becomes necessary when you need group calls
(3+ participants), recording, or advanced features like screen sharing. For the
project's requirements — simple 1-on-1 voice calls — native WebRTC was the
simplest, cheapest, and most educational approach.

### Q: How did you decide which features to cut?

Features explicitly deferred (and why):
- **Group voice calls** — requires an SFU media server (LiveKit / Mediasoup).
- **Screen sharing** — requires `getDisplayMedia` + video track in WebRTC,
  out of scope for an audio-first feature.
- **Push notifications** — requires a service worker and Firebase Cloud
  Messaging or a similar push service; the app is designed as a desktop web
  app, not mobile-first.
- **TURN server** — not deployed due to cost; works on most non-symmetric NAT
  configurations. A production version would add a TURN server for
  connectivity reliability.

### Q: If you were to rewrite this from scratch, what would you do differently?

1. **Separate the Socket.io server** from Next.js into its own process — this
   would allow independent scaling and avoid blocking the event loop with HTTP
   requests during real-time signaling.
2. **Use ECDH + HKDF** instead of RSA-OAEP for E2E encryption — smaller
   payloads, forward secrecy, and faster key generation.
3. **Add TURN server** (coturn) for WebRTC fallback on restrictive NATs.
4. **Service worker** for push notifications and offline message caching.
5. **Use a proper state machine library** (XState) for WebRTC call states
   instead of ad-hoc `useState` + `useRef` + `useEffect` — would eliminate
   the stale-closure and race-condition issues.
6. **Containerize** with Docker for reproducible deployments across
   environments.

### Q: How do you stay updated with the technologies used in this project?

I follow the Next.js blog and GitHub repo for framework updates (especially
the App Router evolution and Turbopack). For WebRTC, I reference the MDN
documentation and the W3C spec directly. For the crypto side, the Web Crypto
API spec and examples from Mozilla's Developer Network are the primary sources.
I also read release notes for Socket.io and Groq SDK when updating
dependencies.

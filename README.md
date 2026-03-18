# RevChat

```
██████╗ ███████╗██╗   ██╗ ██████╗██╗  ██╗ █████╗ ████████╗
██╔══██╗██╔════╝██║   ██║██╔════╝██║  ██║██╔══██╗╚══██╔══╝
██████╔╝█████╗  ██║   ██║██║     ███████║███████║   ██║   
██╔══██╗██╔══╝  ╚██╗ ██╔╝██║     ██╔══██║██╔══██║   ██║   
██║  ██║███████╗ ╚████╔╝ ╚██████╗██║  ██║██║  ██║   ██║   
╚═╝  ╚═╝╚══════╝  ╚═══╝   ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═╝   
```

> **[STATUS: SECURE]** // End-to-end encrypted real-time messaging. No exceptions.

---

## `$ whoami`

RevChat is a **fully end-to-end encrypted** chat application built with a deliberate terminal/hacker aesthetic. Every message is encrypted client-side before it touches the wire — the server never sees your plaintext. Ever.

---

## `$ cat features.txt`

```
[✓] RSA-OAEP + AES-GCM hybrid encryption (E2EE)
[✓] Real-time messaging via Socket.io
[✓] Voice messages with inline audio player
[✓] File & image sharing (up to 15MB)
[✓] Read receipts (sending → sent → delivered → seen)
[✓] Reply-to-message threading
[✓] Message deletion (for everyone)
[✓] AI code review + logic explainer (inline)
[✓] Free AI chat assistant
[✓] Code syntax highlighting (CodeReviewer)
[✓] Animated chat backgrounds (Matrix / Neural / Particles / None)
[✓] Emoji picker
[✓] Drag-and-drop file upload with preview
[✓] Message search (grep mode)
[✓] Forgot password / reset via email
[✓] Terminal-native UI — Fira Code, dark palette, green accents
```

---

## `$ lsblk --tech-stack`

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Styling | Tailwind CSS |
| CDN / Uploads | UploadThing |
| Encryption | Web Crypto API (RSA-OAEP + AES-GCM) |
| Email | Nodemailer (Gmail SMTP) |
| Font | Fira Code (monospace) |

---

## `$ cat crypto.spec`

RevChat uses **hybrid encryption** on every message:

```
1. Generate ephemeral AES-256-GCM key per message
2. Encrypt plaintext → ciphertext (AES-GCM)
3. Wrap AES key with recipient's RSA-OAEP public key
4. Wrap AES key again with sender's own RSA-OAEP public key
5. Store: { ct, iv, wk } — server holds only ciphertext
6. Decrypt: unwrap AES key with private key → decrypt content
```

> Private keys **never leave the device**. They are stored in `localStorage` only.

---

## `$ git clone && npm install`

### Prerequisites

```bash
node >= 18
mongodb (local or Atlas)
gmail account with App Password enabled
```

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/revchat.git
cd revchat

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
```

### `.env.local`

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/socialapp
NEXT_PUBLIC_APP_URL=http://localhost:3000

# UploadThing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Email (Gmail App Password)
EMAIL_USER=you@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
```

### Run

```bash
# Development (Next.js + Socket.io server)
npm run dev

# The socket server runs alongside Next.js
# Default: http://localhost:3000
```

---

## `$ tree src/`

```
src/
├── app/
│   ├── api/
│   │   ├── messages/          # GET, POST, DELETE (E2EE)
│   │   ├── users/             # Profile, public key registry
│   │   ├── upload-file/       # UploadThing file handler
│   │   ├── upload-voice/      # Voice message handler
│   │   ├── forgot-password/   # Token generation + email
│   │   ├── reset-password/    # Token validation + bcrypt
│   │   └── ai/review/         # AI code review (llama-3.3-70b)
│   ├── chat/                  # Chat page (protected)
│   ├── login/                 # Auth pages
│   ├── register/
│   └── reset-password/        # Password reset page
│
├── components/
│   ├── ChatBox.tsx             # Core chat UI
│   ├── ChatList.tsx            # Conversation list
│   ├── CodeReviewer.tsx        # Syntax highlighting
│   ├── AudioMessage.tsx        # Inline voice player
│   ├── FileMessage.tsx         # File/image renderer
│   ├── AskAIModal.tsx          # Context-menu AI prompt
│   ├── FreeAIChat.tsx          # Standalone AI chat panel
│   └── chatBackgrounds/
│       ├── MatrixRain.tsx
│       ├── NeuralBg.tsx
│       └── Particlesbg.tsx
│
├── hooks/
│   ├── useSocket.ts            # Socket.io connection
│   └── useAudioRecorder.ts    # MediaRecorder API wrapper
│
├── lib/
│   └── db.ts                  # MongoDB connection (cached)
│
├── models/
│   ├── Message.ts             # { senderId, receiverId, content, contentSender, deleted }
│   └── User.ts                # { username, email, publicKey, avatar }
│
├── middleware.ts              # JWT auth + route protection
└── server.js                  # Socket.io server (custom Next.js server)
```

---

## `$ cat message.schema`

```typescript
// All content fields store encrypted JSON blobs: { ct, iv, wk }
// content      → encrypted for recipient
// contentSender → encrypted for sender (allows own message history)
// deleted       → soft delete flag (nulls content fields)

{
  senderId:      ObjectId,
  receiverId:    ObjectId,
  content:       String | null,   // encrypted for recipient
  contentSender: String | null,   // encrypted for sender
  deleted:       Boolean,
  delivered:     Boolean,
  seen:          Boolean,
  createdAt:     Date
}
```

---

## `$ cat message.formats`

RevChat uses packet-prefixed content strings to embed rich media inside encrypted payloads:

```
AUDIO_PACKET:<url>
FILE_PACKET:<url>|<filename>|<mimetype>
REPLY_PACKET:<quoted_text>|<actual_message>
### 🧠 LOGIC_EXPLAINED\n\n<ai_output>
```

---

## `$ cat socket.events`

| Event | Direction | Description |
|---|---|---|
| `send-message` | client → server | Relay encrypted message |
| `receive-message` | server → client | Deliver to recipient |
| `typing` | client → server | Typing indicator |
| `display-typing` | server → client | Show typing to peer |
| `seen-messages` | client → server | Mark messages read |
| `messages-seen` | server → client | Update tick to blue |
| `message-delivered` | server → client | Double tick |
| `delete-message` | client → server | Broadcast deletion |
| `message-deleted` | server → client | Remove from peer's UI |

---

## `$ cat contributing.md`

```bash
# Fork → branch → PR
git checkout -b feature/your-feature
npm run dev
# Make changes, test locally
git commit -m "feat: your feature"
git push origin feature/your-feature
```

Code style: TypeScript strict, Tailwind utility-first, Fira Code monospace everywhere.

---

## `$ cat license.txt`

MIT License — see `LICENSE` for details.

---

```
// tunnel_status: ACTIVE
// encryption: RSA-OAEP + AES-256-GCM
// built by: Muhammed Qais
```
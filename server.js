const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

let onlineUsers = new Map(); // userId -> socketId

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    // USER JOINS
    socket.on("join", (userId) => {
      socket.join(userId);
      onlineUsers.set(userId, socket.id);
      console.log(`✅ User [${userId}] joined. Online count: ${onlineUsers.size}`);
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    });

    // MESSAGING
    socket.on("send-message", ({ to, message, senderId }) => {
      const isReceiverOnline = onlineUsers.has(to);
      const payload = {
        content: message,
        senderId,
        receiverId: to,
        createdAt: new Date().toISOString(),
        seen: false,
        delivered: isReceiverOnline, // mark delivered immediately if online
      };

      io.to(to).to(senderId).emit("receive-message", payload);

      // If receiver is online, notify sender their message was delivered
      if (isReceiverOnline) {
        io.to(senderId).emit("message-delivered", { to, from: senderId });

        // Persist delivered status to DB
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/messages/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId, receiverId: to, status: "delivered" }),
        }).catch((err) => console.error("Delivered DB update failed:", err));
      }
    });

    // TYPING
    socket.on("typing", (data) => {
      io.to(data.to).emit("display-typing", {
        from: data.from,
        isTyping: data.isTyping,
      });
    });

  
    socket.on("seen-messages", ({ senderId, receiverId }) => {
      io.to(senderId).emit("messages-seen", { seenBy: receiverId });

      // Persist seen to DB
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/messages/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId, receiverId, status: "seen" }),
      }).catch((err) => console.error("Seen DB update failed:", err));
    });

    // GROUP: Join room
    socket.on("join-group", (groupId) => {
      socket.join(`group:${groupId}`);
      console.log(`🟣 Socket [${socket.id}] joined group room [${groupId}]`);
    });

    // GROUP: Broadcast message
    socket.on("send-group-message", ({ groupId, message, senderId, senderName, senderAvatar }) => {
      const payload = {
        groupId,
        senderId,
        senderName,
        senderAvatar: senderAvatar || "",
        content: message,
        createdAt: new Date().toISOString(),
      };
      io.to(`group:${groupId}`).emit("receive-group-message", payload);
    });

    // GROUP: Typing
    socket.on("group-typing", ({ groupId, from, fromName, isTyping }) => {
      socket.to(`group:${groupId}`).emit("group-display-typing", {
        from,
        fromName,
        isTyping,
      });
    });

    // GROUP: Updates
    socket.on("trigger-group-update", (data) => {
      if (data.action === "delete") {
        io.emit("group-deleted", data.groupId);
        io.emit("group-updated", data);
      } else {
        io.emit("group-updated", data);
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      let disconnectedUserId = null;
      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }
      console.log(`❌ User [${disconnectedUserId}] disconnected.`);
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    });
  });

  server.listen(3000, () => console.log("🚀 Server ready on http://localhost:3000"));
});
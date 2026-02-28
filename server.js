const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Store online users outside the connection scope
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
      
      // Map the userId to this specific socket
      onlineUsers.set(userId, socket.id);
      
      console.log(`✅ User [${userId}] joined. Online count: ${onlineUsers.size}`);
      
      // Broadcast the updated list of userIds to all clients
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    });

    // MESSAGING LOGIC
    socket.on("send-message", ({ to, message, senderId }) => {
      const payload = {
        content: message,
        senderId: senderId,
        receiverId: to,
        createdAt: new Date().toISOString(),
        seen: false,
      };
      io.to(to).to(senderId).emit("receive-message", payload);
    });

    // TYPING LOGIC
    socket.on("typing", (data) => {
      io.to(data.to).emit("display-typing", { 
        from: data.from, 
        isTyping: data.isTyping 
      });
    });

    // SEEN LOGIC
    socket.on("seen-messages", ({ senderId, receiverId }) => {
      io.to(senderId).emit("messages-seen", { seenBy: receiverId });
    });

    // GROUP: Join a group room
    socket.on("join-group", (groupId) => {
      socket.join(`group:${groupId}`);
      console.log(`🟣 Socket [${socket.id}] joined group room [${groupId}]`);
    });

    // GROUP: Broadcast a message to all group members
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

    // GROUP: Typing indicator inside a group
    socket.on("group-typing", ({ groupId, from, fromName, isTyping }) => {
      // Broadcast to group room but exclude the sender
      socket.to(`group:${groupId}`).emit("group-display-typing", {
        from,
        fromName,
        isTyping,
      });
    });

    // GROUP: Signal that a group was created, deleted, or members changed
    // This allows clients to re-fetch their group list or active group
    socket.on("trigger-group-update", (data) => {
      // We broadcast this to everyone. Clients will decide if they need to refresh 
      // based on whether they are in the group or if it's a new group they might be part of.
      io.emit("group-updated", data);
    });

    // DISCONNECT LOGIC
    socket.on("disconnect", () => {
      let disconnectedUserId = null;
      
      // Find which userId belongs to this socketId
      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          onlineUsers.delete(userId);
          break;
        }
      }
      
      console.log(`❌ User [${disconnectedUserId}] disconnected.`);
      
      // Update everyone that someone went offline
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    });
  });

  server.listen(3000, () => console.log("🚀 Server ready on http://localhost:3000"));
});
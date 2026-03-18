// lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(userId: string) {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BASE_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket!.emit("join", userId);
      console.log("🟢 Joined as", userId);
    });
  }

  return socket;
}

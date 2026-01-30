import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket(userId: string) {
  const socketRef = useRef<Socket | null>(null);

  // useSocket.ts
useEffect(() => {
  if (!userId) return;

  if (!socket) {
    socket = io("http://localhost:3000", {
      transports: ["websocket"],
      reconnection: true,
    });
  }
  socketRef.current = socket;

  // FIX: Force join room even if already connected
  if (socket.connected) {
    console.log("Emitting join for:", userId);
    socket.emit("join", userId);
  }

  const onConnect = () => {
    socket?.emit("join", userId);
  };

  socket.on("connect", onConnect);
  return () => {
    socket?.off("connect", onConnect);
  };
}, [userId]); // This ensures that if the userId changes, we join the new room userId change triggers the join emit

  return socketRef;
}
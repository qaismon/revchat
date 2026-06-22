"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Socket } from "socket.io-client";
import type { CallState } from "@/types";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(socketRef: React.MutableRefObject<Socket | null>) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const endCallFnRef = useRef<() => void>(() => {});
  const connectedRef = useRef(false);

  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callPeerId, setCallPeerId] = useState<string | null>(null);
  const [callPeerName, setCallPeerName] = useState("");

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    stopRingtone();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setRemoteStream(null);
    setCallDuration(0);
    setIsMuted(false);
    connectedRef.current = false;
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    if (ringtoneRef.current) {
      ringtoneRef.current.close().catch(() => {});
      ringtoneRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    stopRingtone();
    try {
      const ctx = new AudioContext();
      ringtoneRef.current = ctx;
      const play = () => {
        if (!ringtoneRef.current || ringtoneRef.current.state === "closed") return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0, ctx.currentTime + 1.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      };
      play();
      ringIntervalRef.current = setInterval(play, 1600);
    } catch { /* audio not available */ }
  }, [stopRingtone]);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, []);

  const flushCandidates = useCallback(() => {
    while (pendingCandidates.current.length) {
      const c = pendingCandidates.current.shift();
      if (c && pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
    }
  }, []);

  const createPC = useCallback(async () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && peerIdRef.current) {
        console.log("[WebRTC] Sending ICE candidate to", peerIdRef.current);
        socketRef.current?.emit("ice-candidate", { to: peerIdRef.current, candidate: e.candidate.toJSON() });
      } else {
        console.log("[WebRTC] ICE candidate gathering complete");
      }
    };

    pc.ontrack = (e) => {
      const tracks = e.streams[0]?.getTracks();
      console.log("[WebRTC] Received remote track, tracks:", tracks?.length, tracks?.map(t => t.kind));
      setRemoteStream(e.streams[0]);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
      if ((pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") && !connectedRef.current) {
        connectedRef.current = true;
        setCallState("connected");
        startTimer();
      }
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        endCallFnRef.current();
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (pc.signalingState === "closed") {
        stream.getTracks().forEach(t => t.stop());
        throw new Error("PC was closed during getUserMedia");
      }
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      console.log("[WebRTC] Local stream acquired, tracks added");
    } catch (err) {
      console.error("[WebRTC] getUserMedia failed:", err);
      throw err;
    }

    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef]);

  const startCall = useCallback(async (peerId: string, peerName: string) => {
    peerIdRef.current = peerId;
    setCallPeerId(peerId);
    setCallPeerName(peerName);
    setCallState("calling");
    playRingtone();
    try {
      const pc = await createPC();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebRTC] Offer created, sending call-offer to", peerId);
      socketRef.current?.emit("call-offer", { to: peerId, sdp: offer, userName: peerName });
    } catch (err) {
      console.error("[WebRTC] startCall failed:", err);
      cleanup();
      setCallState("idle");
      setCallPeerId(null);
    }
  }, [createPC, socketRef, cleanup, playRingtone]);

  const answerCall = useCallback(async () => {
    if (!pendingOfferRef.current || !peerIdRef.current) {
      console.error("[WebRTC] answerCall: missing pending offer or peerId");
      return;
    }
    stopRingtone();
    setCallState("calling");
    try {
      const pc = await createPC();
      console.log("[WebRTC] Setting remote description from pending offer");
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      pendingOfferRef.current = null;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[WebRTC] Answer created, sending call-answer to", peerIdRef.current);
      socketRef.current?.emit("call-answer", { to: peerIdRef.current, sdp: answer });
      flushCandidates();
    } catch (err) {
      console.error("[WebRTC] answerCall failed:", err);
      cleanup();
      setCallState("idle");
      setCallPeerId(null);
    }
  }, [createPC, socketRef, flushCandidates, cleanup, stopRingtone]);

  const endCall = useCallback(() => {
    console.log("[WebRTC] Ending call");
    stopRingtone();
    if (peerIdRef.current) {
      socketRef.current?.emit("call-end", { to: peerIdRef.current });
    }
    cleanup();
    setCallState("ended");
  }, [socketRef, cleanup, stopRingtone]);

  endCallFnRef.current = endCall;

  const declineCall = useCallback(() => {
    stopRingtone();
    if (peerIdRef.current) {
      socketRef.current?.emit("call-decline", { to: peerIdRef.current });
    }
    cleanup();
    setCallState("idle");
    setCallPeerId(null);
    setCallPeerName("");
    peerIdRef.current = null;
    pendingOfferRef.current = null;
  }, [socketRef, cleanup, stopRingtone]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const enabled = localStreamRef.current.getAudioTracks().every(t => t.enabled);
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !enabled; });
      const muted = !enabled;
      setIsMuted(muted);
      if (peerIdRef.current) {
        socketRef.current?.emit("call-mute", { to: peerIdRef.current, muted });
      }
    }
  }, [socketRef]);

  const handleIncomingCall = useCallback((data: { from: string; userName: string; sdp: RTCSessionDescriptionInit }) => {
    console.log("[WebRTC] Incoming call from", data.from, data.userName);
    peerIdRef.current = data.from;
    setCallPeerId(data.from);
    setCallPeerName(data.userName);
    pendingOfferRef.current = data.sdp;
    setCallState("incoming");
    playRingtone();
  }, [playRingtone]);

  const handleRemoteAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    stopRingtone();
    if (pcRef.current) {
      try {
        console.log("[WebRTC] Setting remote description from answer");
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        flushCandidates();
      } catch (err) {
        console.error("[WebRTC] handleRemoteAnswer failed:", err);
      }
    } else {
      console.error("[WebRTC] handleRemoteAnswer: no PC found");
    }
  }, [flushCandidates, stopRingtone]);

  const handleIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    if (pcRef.current?.remoteDescription) {
      pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  const handleRemoteEnded = useCallback(() => {
    console.log("[WebRTC] Remote ended call");
    stopRingtone();
    cleanup();
    setCallState("ended");
  }, [cleanup, stopRingtone]);

  const handleRemoteDeclined = useCallback(() => {
    console.log("[WebRTC] Remote declined call");
    stopRingtone();
    cleanup();
    setCallState("ended");
  }, [cleanup, stopRingtone]);

  const handleRemoteMuted = useCallback((_muted: boolean) => {
    // could show a peer-muted indicator
  }, []);

  useEffect(() => {
    if (callState === "ended") {
      const t = setTimeout(() => {
        setCallState("idle");
        setCallPeerId(null);
        setCallPeerName("");
        peerIdRef.current = null;
        connectedRef.current = false;
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [callState]);

  useEffect(() => {
    return () => {
      stopRingtone();
      cleanup();
    };
  }, [cleanup, stopRingtone]);

  return {
    callState, remoteStream, isMuted, callDuration, callPeerId, callPeerName,
    startCall, answerCall, endCall, declineCall, toggleMute,
    handleIncomingCall, handleRemoteAnswer, handleIceCandidate,
    handleRemoteEnded, handleRemoteDeclined, handleRemoteMuted,
  };
}

"use client";
import { useRef, useState, useEffect } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef("audio/webm");

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async (): Promise<boolean> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      return true;
    } catch (err: any) {
      const msg =
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Microphone access denied"
          : "Microphone unavailable";
      setError(msg);
      return false;
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state !== "recording") {
        clearTimer();
        setIsRecording(false);
        return resolve(null);
      }

      mediaRecorder.onstop = () => {
        clearTimer();
        if (chunksRef.current.length === 0) {
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
          setError("Recording too short — no audio data captured");
          resolve(null);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        chunksRef.current = [];
        setIsRecording(false);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  };

  const cancelRecording = () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.onstop = () => {
        clearTimer();
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        chunksRef.current = [];
        setIsRecording(false);
      };
      mediaRecorder.stop();
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") {
        mr.stream.getTracks().forEach((t) => t.stop());
        mr.stop();
      }
    };
  }, []);

  return { isRecording, recordingTime, error, startRecording, stopRecording, cancelRecording };
}
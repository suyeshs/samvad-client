/**
 * useSimpleVoice - Simplified voice processing hook
 *
 * Replaces complex WebSocket + XState system with simple HTTP API calls
 */

import { useState, useCallback, useRef } from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { VoiceService, VoiceResponse } from "../services/VoiceService";
import { float32ArrayToWav } from "../utils/audioUtils";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export interface UseSimpleVoiceReturn {
  status: VoiceStatus;
  error: string | null;
  isStarted: boolean;
  startVoiceAssistant: () => Promise<void>;
  stopVoiceAssistant: () => void;
  handleInterruption: () => void;
}

export function useSimpleVoice(language: string): UseSimpleVoiceReturn {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);

  const vadRef = useRef<{ start: () => void; destroy: () => void } | null>(
    null
  );
  const voiceService = VoiceService.getInstance();
  const isProcessingRef = useRef(false);

  const startVoiceAssistant = useCallback(async () => {
    try {
      console.log("[SimpleVoice] Starting voice assistant...");
      setStatus("starting");
      setError(null);

      // Initialize VAD
      const vad = await MicVAD.new({
        onSpeechStart: () => {
          console.log("[SimpleVoice] Speech started");
          if (status === "speaking") {
            handleInterruption();
          }
        },
        onSpeechEnd: async (audio) => {
          console.log("[SimpleVoice] Speech ended, processing...");
          if (isProcessingRef.current) {
            console.log("[SimpleVoice] Already processing, ignoring");
            return;
          }

          isProcessingRef.current = true;
          setStatus("processing");

          try {
            // Convert audio to WAV
            const wavData = float32ArrayToWav(audio);
            const audioBlob = new Blob([wavData], { type: "audio/wav" });

            // Process with HTTP API
            const response = await voiceService.processVoice(
              audioBlob,
              language
            );

            if (response.success && response.audioUrl) {
              setStatus("speaking");

              // Play the response
              const playSuccess = await voiceService.playAudio(
                response.audioUrl
              );

              if (playSuccess) {
                console.log(
                  "[SimpleVoice] Audio playback completed, returning to listening"
                );
                setStatus("listening");
              } else {
                console.error("[SimpleVoice] Audio playback failed");
                setError("Audio playback failed");
                setStatus("error");
              }
            } else {
              console.error(
                "[SimpleVoice] Voice processing failed:",
                response.error
              );
              setError(response.error || "Voice processing failed");
              setStatus("error");
            }
          } catch (error) {
            console.error("[SimpleVoice] Processing error:", error);
            setError(
              error instanceof Error ? error.message : "Processing failed"
            );
            setStatus("error");
          } finally {
            isProcessingRef.current = false;
          }
        }
      });

      vadRef.current = vad;
      vad.start();
      setIsStarted(true);
      setStatus("listening");

      console.log("[SimpleVoice] Voice assistant started successfully");
    } catch (error) {
      console.error("[SimpleVoice] Failed to start voice assistant:", error);
      setError(error instanceof Error ? error.message : "Failed to start");
      setStatus("error");
      setIsStarted(false);
    }
  }, [language, status]);

  const stopVoiceAssistant = useCallback(() => {
    console.log("[SimpleVoice] Stopping voice assistant...");

    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }

    setIsStarted(false);
    setStatus("idle");
    setError(null);
    isProcessingRef.current = false;

    console.log("[SimpleVoice] Voice assistant stopped");
  }, []);

  const handleInterruption = useCallback(() => {
    console.log("[SimpleVoice] Handling interruption...");

    // Stop any current audio playback
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    // Reset to listening state
    if (isStarted && !isProcessingRef.current) {
      setStatus("listening");
    }
  }, [isStarted]);

  return {
    status,
    error,
    isStarted,
    startVoiceAssistant,
    stopVoiceAssistant,
    handleInterruption
  };
}

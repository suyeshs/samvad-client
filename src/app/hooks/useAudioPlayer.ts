import { useState, useCallback, useRef } from "react";

// Singleton audio state (like useMicrosoftSpeech pattern)
let activePlayer: HTMLAudioElement | null = null;
let isSpeaking = false;
let audioUnlocked = false;
const queue: Array<{
  audioUrl: string;
  onEnd?: () => void;
  onError?: () => void;
}> = [];

const useAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Safari audio unlock function
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return true;

    try {
      console.log("[Audio] Unlocking audio for Safari...");

      // Create a silent audio element to unlock audio context
      const silentAudio = new Audio();
      silentAudio.src =
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";
      silentAudio.volume = 0;
      silentAudio.preload = "auto";

      // Try to play the silent audio
      await silentAudio.play();
      silentAudio.pause();
      silentAudio.src = "";

      // Also unlock audio context if available
      if (typeof window !== "undefined" && window.AudioContext) {
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        audioContext.close();
      }

      audioUnlocked = true;
      console.log("[Audio] Audio unlocked successfully for Safari");
      return true;
    } catch (error) {
      console.error("[Audio] Failed to unlock audio:", error);
      return false;
    }
  }, []);

  const playNextInQueue = useCallback(() => {
    if (queue.length > 0) {
      const next = queue.shift();
      if (next) {
        // Call playAudioFromUrl directly to avoid circular dependency
        if (isSpeaking) {
          console.log("[Audio] Already speaking, queuing audio");
          queue.push({
            audioUrl: next.audioUrl,
            onEnd: next.onEnd,
            onError: next.onError
          });
          return;
        }

        console.log("[Audio] Playing audio from URL:", next.audioUrl);
        isSpeaking = true;
        setIsPlaying(true);

        // Clean up any existing player
        if (activePlayer) {
          activePlayer.pause();
          activePlayer = null;
        }

        // Create new audio element
        const audioElement = new Audio(next.audioUrl);
        activePlayer = audioElement;

        // Set up event handlers
        audioElement.addEventListener("ended", () => {
          console.log("[Audio] Audio playback ended (from queue)");
          activePlayer = null;
          isSpeaking = false;
          console.log("[Audio] Setting isPlaying to false (from queue)");
          setIsPlaying(false);
          if (next.onEnd) next.onEnd();
          playNextInQueue();
        });

        audioElement.addEventListener("error", (error) => {
          console.error("[Audio] Audio playback error:", error);
          activePlayer = null;
          isSpeaking = false;
          setIsPlaying(false);
          if (next.onError) next.onError();
          playNextInQueue();
        });

        // Start playback
        audioElement.play().catch((error) => {
          console.error("[Audio] Failed to start playback:", error);
          activePlayer = null;
          isSpeaking = false;
          setIsPlaying(false);
          if (next.onError) next.onError();
          playNextInQueue();
        });
      }
    }
  }, []);

  const playAudioFromUrl = useCallback(
    (audioUrl: string, onEnd?: () => void, onError?: () => void) => {
      if (isSpeaking) {
        console.log("[Audio] Already speaking, queuing audio");
        queue.push({ audioUrl, onEnd, onError });
        return;
      }

      console.log("[Audio] Playing audio from URL:", audioUrl);
      isSpeaking = true;
      setIsPlaying(true);

      // Clean up any existing player
      if (activePlayer) {
        activePlayer.pause();
        activePlayer = null;
      }

      // Create new audio element
      const audioElement = new Audio(audioUrl);
      activePlayer = audioElement;

      // Set up event handlers
      audioElement.addEventListener("ended", () => {
        console.log("[Audio] Audio playback ended");
        activePlayer = null;
        isSpeaking = false;
        console.log("[Audio] Setting isPlaying to false");
        setIsPlaying(false);
        if (onEnd) onEnd();
        playNextInQueue();
      });

      audioElement.addEventListener("error", (error) => {
        console.error("[Audio] Audio playback error:", error);
        activePlayer = null;
        isSpeaking = false;
        setIsPlaying(false);
        if (onError) onError();
        playNextInQueue();
      });

      // Start playback with Safari compatibility
      const startPlayback = async () => {
        try {
          await audioElement.play();
          console.log("[Audio] Playback started successfully");
        } catch (error) {
          console.error("[Audio] Failed to start playback:", error);

          // If it's a NotAllowedError, try to unlock audio first
          if (error instanceof Error && error.name === "NotAllowedError") {
            console.log(
              "[Audio] NotAllowedError detected, attempting to unlock audio..."
            );

            try {
              // Try to unlock audio
              const unlocked = await unlockAudio();
              if (unlocked) {
                // Retry playback after unlocking
                try {
                  await audioElement.play();
                  console.log(
                    "[Audio] Playback started successfully after unlock"
                  );
                  return;
                } catch (retryError) {
                  console.error(
                    "[Audio] Playback still failed after unlock:",
                    retryError
                  );
                }
              }
            } catch (unlockError) {
              console.error("[Audio] Failed to unlock audio:", unlockError);
            }
          }

          // If all else fails, clean up and call error handler
          activePlayer = null;
          isSpeaking = false;
          setIsPlaying(false);
          if (onError) onError();
          playNextInQueue();
        }
      };

      startPlayback();
    },
    [playNextInQueue, unlockAudio]
  );

  const cancelSpeech = useCallback(() => {
    if (activePlayer) {
      console.log("[Audio] Cancelling speech");
      activePlayer.pause();
      activePlayer = null;
      isSpeaking = false;
      setIsPlaying(false);
      queue.length = 0; // Clear queue
    }
  }, []);

  const isCurrentlySpeaking = useCallback(() => {
    return isSpeaking;
  }, []);

  return {
    isPlaying,
    playAudioFromUrl,
    cancelSpeech,
    isCurrentlySpeaking,
    unlockAudio
  };
};

export default useAudioPlayer;

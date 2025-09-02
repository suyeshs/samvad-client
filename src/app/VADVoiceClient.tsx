/**
 * VADVoiceClient.tsx - Main Voice Assistant Component
 *
 * This is the core component that handles:
 * - Voice Activity Detection (VAD)
 * - HTTP communication with the AI server
 * - Audio playback and TTS
 * - State management for conversation flow
 * - Multilingual language support
 *
 * @author Developer Team
 * @version 1.0.0
 */
"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { useMachine } from "@xstate/react";
import { voiceAssistantMachine } from "./machines/voiceAssistantMachine";
import { usePermissions } from "./hooks/usePermissions";
import { useLanguagePreferences } from "./hooks/useLanguagePreferences";
import { useAudioVisualization } from "./hooks/useAudioVisualization";
import { useLocalStorageBoolean } from "./hooks/useLocalStorage";

import {
  LanguageConfig,
  getIndianLanguages
} from "./services/LanguageDetectionService";
import { HttpVoiceService } from "./services/HttpVoiceService";
import useAudioPlayer from "./hooks/useAudioPlayer";
import { float32ArrayToWav } from "./utils/audioUtils";

import LanguageSelection from "./components/LanguageSelection";
import { Header } from "./components/Header";
import { Greeting } from "./components/Greeting";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { StatusDisplay } from "./components/StatusDisplay";
import { PermissionsStatus } from "./components/PermissionsStatus";
import { StartButton } from "./components/StartButton";
import { SafariAudioPermission } from "./components/SafariAudioPermission";

/**
 * Performance Configuration Object
 *
 * Optimized settings for low-latency voice assistant performance:
 * - CONNECTION_TIMEOUT: Reduced for faster error detection
 * - PING_INTERVAL: Optimized for connection health monitoring
 * - DEBOUNCE_DELAY: Minimized for responsive UI updates
 * - PREWARM_CONNECTIONS: Enables connection pre-warming for faster startup
 */
const PERFORMANCE_CONFIG = {
  CONNECTION_TIMEOUT: 3000, // Reduced from 10s to 3s
  PING_INTERVAL: 15000, // Reduced from 30s to 15s
  DEBOUNCE_DELAY: 25, // Reduced from 50ms to 25ms
  AUDIO_BUFFER_SIZE: 4096,
  PREWARM_CONNECTIONS: true,
  STREAM_AUDIO_DIRECTLY: true
};

// Performance monitoring and optimization utilities
const performanceMetrics = {
  connectionStart: 0,
  audioReceived: 0,
  audioPlayback: 0,
  totalResponseTime: 0
};

/**
 * Track performance metrics for voice assistant operations
 *
 * Monitors and logs performance data for:
 * - Connection establishment time
 * - Audio response time
 * - Total end-to-end response time
 *
 * @param {string} stage - The performance stage to track ('connection_start', 'audio_received', 'audio_playback')
 * @returns {void}
 */
const trackPerformance = (stage: string) => {
  const now = performance.now();
  switch (stage) {
    case "connection_start":
      performanceMetrics.connectionStart = now;
      console.log("[Performance] Connection started:", now);
      break;
    case "audio_received":
      performanceMetrics.audioReceived = now;
      const connectionTime = now - performanceMetrics.connectionStart;
      console.log(
        "[Performance] Audio received in:",
        connectionTime.toFixed(2),
        "ms"
      );
      break;
    case "audio_playback":
      performanceMetrics.audioPlayback = now;
      const totalTime = now - performanceMetrics.connectionStart;
      performanceMetrics.totalResponseTime = totalTime;
      console.log(
        "[Performance] Total response time:",
        totalTime.toFixed(2),
        "ms"
      );
      break;
  }
};

// Enhanced Audio Context Manager with Multilingual Support
class AudioContextManager {
  private static instance: AudioContextManager;
  private isLocked = false;

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  lockAudioContext() {
    this.isLocked = true;
    console.log("[AudioContext] Audio context locked");
  }

  unlockAudioContext() {
    this.isLocked = false;
    console.log("[AudioContext] Audio context unlocked");
  }

  isAudioLocked(): boolean {
    return this.isLocked;
  }

  stopAllAudio() {
    console.log("[AudioContext] Stopping all audio contexts");
  }

  async initializeAudioContext(): Promise<void> {
    console.log("[AudioContext] Initializing audio context...");
    // Simplified initialization - just log that we're ready
    console.log("[AudioContext] Audio context ready");
  }

  updateUserContext(context: any) {
    console.log("[AudioContext] User context updated:", context);
  }

  getUserContext() {
    return {
      sessionData: {
        dialectPreferences: {}
      }
    };
  }

  trackLanguageUsage(languageCode: string, dialect: string) {
    console.log(
      "[AudioContext] Language usage tracked:",
      languageCode,
      dialect
    );
  }
}

/**
 * Main Voice Assistant Component
 *
 * Manages the complete voice assistant lifecycle including:
 * - State management with XState
 * - HTTP communication
 * - Voice Activity Detection (VAD)
 * - Audio playback and TTS
 * - Multilingual language support
 *
 * @returns {JSX.Element} The voice assistant UI
 */
export default function VADVoiceClient() {
  // Initialize hooks and managers
  const permissions = usePermissions();
  const languagePrefs = useLanguagePreferences();
  const audioViz = useAudioVisualization();
  const audioContextManager = useMemo(
    () => AudioContextManager.getInstance(),
    []
  );

  const [isStarted, setIsStarted] = useState(false);

  // Persist language selection preference across sessions
  const [hasSelectedLanguage, setHasSelectedLanguage] = useLocalStorageBoolean(
    "hasSelectedLanguage",
    false
  );
  const [showSafariAudioPermission, setShowSafariAudioPermission] =
    useState(false);
  const [isListeningAfterSensitiveError, setIsListeningAfterSensitiveError] =
    useState(false);

  const httpVoiceService = HttpVoiceService.getInstance();
  const vadRef = useRef<{ start: () => void; destroy: () => void } | null>(
    null
  );
  const isProcessingRef = useRef(false);

  const isCleaningUpRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const lastInterruptionTimeRef = useRef(0);
  const vadPausedRef = useRef(false);
  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failedAudioAttemptsRef = useRef(0);

  const [state, send] = useMachine(voiceAssistantMachine);

  // Use the audio player hook (like useMicrosoftSpeech pattern)
  const {
    isPlaying: isAudioPlaying,
    playAudioFromUrl,
    cancelSpeech,
    unlockAudio
  } = useAudioPlayer();

  // Debug audio playing state
  useEffect(() => {
    console.log(
      "[VADVoiceClient] isAudioPlaying state changed:",
      isAudioPlaying
    );
  }, [isAudioPlaying]);

  /**
   * Optimized debounced send function for faster response times
   *
   * Prevents rapid state updates by debouncing XState events.
   * This improves performance and prevents UI flickering during
   * rapid state transitions.
   *
   * @param {any} event - The XState event to send
   * @returns {void}
   */
  const debouncedSend = useCallback(
    (event: any) => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
      }

      stateUpdateTimeoutRef.current = setTimeout(() => {
        send(event);
      }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY); // Reduced debounce delay
    },
    [send]
  );

  // Refs for functions used in VAD to prevent dependency issues
  const sendRef = useRef<any>(null);
  const audioVizRef = useRef<any>(null);
  const languagePrefsRef = useRef<any>(null);
  const startMicBarsRef = useRef<any>(null);
  const stopAudioBarsRef = useRef<any>(null);
  const stopMicBarsRef = useRef<any>(null);
  const audioContextManagerRef = useRef<any>(null);

  // State transition logging - using XState's built-in logging instead of useEffect
  // This is more efficient as it's handled by the state machine itself

  // Update refs when dependencies change - using useEffect to prevent infinite re-renders
  useEffect(() => {
    sendRef.current = debouncedSend;
  }, [debouncedSend]);

  // Update hook refs in a separate useEffect to avoid dependency issues
  // Use useCallback to stabilize the dependencies and prevent infinite re-renders
  const updateHookRefs = useCallback(() => {
    audioVizRef.current = audioViz;
    languagePrefsRef.current = languagePrefs;
    audioContextManagerRef.current = audioContextManager;
  }, [audioViz, languagePrefs, audioContextManager]);

  useEffect(() => {
    updateHookRefs();
  }, [updateHookRefs]);

  const vadError = state.context.error;

  // State timeout for preventing stuck states
  const [stateTimeout, setStateTimeout] = useState<number | null>(null);

  const getStatusText = (stateValue: string) => {
    const statusMap: Record<string, string> = {
      idle: "Not Started",
      starting: "Starting...",
      ready: "System Ready",
      listening: "Listening...",
      processing: "Processing...",
      responding: "Responding...",
      interrupted: "Interrupted",
      error: "Error"
    };
    return statusMap[stateValue] || "Unknown";
  };

  const status = getStatusText(state.value as string);
  const isListening = state.matches("listening");
  const isProcessingState = state.matches("processing");
  const isSpeaking = state.matches("responding");

  // Monitor state to prevent getting stuck
  useEffect(() => {
    // Clear any existing state timeout
    if (stateTimeout) {
      clearTimeout(stateTimeout);
    }

    // Set a timeout to prevent getting stuck in any state for too long
    const timeoutId = window.setTimeout(() => {
      console.log("[State] State timeout reached, current state:", state.value);

      // If we're stuck in starting state, force transition to ready
      if (state.value === "starting") {
        console.log("[State] Forcing transition from starting to ready");
        debouncedSend({ type: "READY" });
      }
      // If we're stuck in processing state, force transition to ready
      else if (state.value === "processing" && !isProcessingRef.current) {
        console.log("[State] Forcing transition from processing to ready");
        debouncedSend({ type: "READY" });
      }
    }, 30000); // 30 second timeout (increased from 10s)

    setStateTimeout(timeoutId);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.value, debouncedSend]); // Removed stateTimeout from dependencies

  // Enhanced language change handler with dialect support
  const handleLanguageChange = useCallback(
    (language: LanguageConfig) => {
      languagePrefs.setCurrentLanguage(language);
      setHasSelectedLanguage(true);

      // Track language usage for better dialect selection
      audioContextManager.trackLanguageUsage(language.code, ""); // No dialect preference for now

      // Note: Removed automatic greeting playback - user can start conversation when ready

      // Reset any existing conversation state
      debouncedSend({ type: "CANCEL" });
      setIsStarted(false);
    },
    [debouncedSend, languagePrefs, audioContextManager]
  );

  // Pause VAD during TTS playback
  const pauseVAD = useCallback(() => {
    if (vadRef.current && !vadPausedRef.current) {
      try {
        console.log("[VAD] Pausing VAD for TTS playback");
        // Don't destroy VAD, just mark it as paused
        vadPausedRef.current = true;
      } catch (error) {
        console.error("[VAD] Error pausing VAD:", error);
      }
    }
  }, []);

  // Resume VAD after TTS playback
  const resumeVAD = useCallback(async () => {
    if (vadPausedRef.current) {
      try {
        console.log("[VAD] Attempting to resume VAD");

        // If VAD was destroyed, we need to reinitialize it
        if (!vadRef.current) {
          console.log("[VAD] VAD was destroyed, reinitializing...");
          // Trigger VAD reinitialization by setting isStarted to false then true
          setIsStarted(false);
          setTimeout(() => {
            setIsStarted(true);
          }, 100);
          return;
        }

        // Try to start the existing VAD instance
        vadRef.current.start();
        vadPausedRef.current = false;
        console.log("[VAD] VAD resumed successfully");
      } catch (error) {
        console.error("[VAD] Error resuming VAD:", error);
        // If starting fails, reinitialize VAD
        console.log("[VAD] VAD start failed, reinitializing...");
        setIsStarted(false);
        setTimeout(() => {
          setIsStarted(true);
        }, 100);
      }
    }
  }, []);

  useEffect(() => {
    // Add a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        permissions.checkMediaDevicesSupport();
      }
    }, 100);

    // Remove automatic language detection - let user choose their preferred language
    // const mockCfData: CFData = {
    //   country: "IN",
    //   locale: "kn-IN"
    // };
    // languagePrefs.detectAndSetLanguage(mockCfData);

    return () => clearTimeout(timer);
  }, [permissions]); // Remove languagePrefs dependency to prevent re-running

  // Audio bar functions - declare before VAD setup

  const startAudioBars = useCallback(() => {
    audioViz.startAudioBars();
  }, [audioViz]);

  const stopAudioBars = useCallback(() => {
    audioViz.stopAudioBars();
  }, [audioViz]);

  const startMicBars = useCallback(async () => {
    // Reset cleanup flag
    isCleaningUpRef.current = false;

    // Check if we have audio permission
    if (!permissions.canUseAudio) {
      console.log("[MicBars] No audio permission, using simulated bars");
      startSimulatedBars();
      return;
    }

    try {
      console.log("[MicBars] Starting simplified microphone bars...");

      // Simple animated bars that respond to microphone activity
      const animateBars = () => {
        if (isCleaningUpRef.current) {
          return;
        }

        // Create bars with some randomness and smooth transitions
        const bars = Array.from({ length: 32 }, () => {
          // Base height with some variation
          const baseHeight = Math.random() * 40 + 10;
          // Add some wave-like movement
          const wave = Math.sin(Date.now() * 0.005 + Math.random() * 10) * 15;
          return Math.max(5, Math.min(80, baseHeight + wave));
        });

        audioViz.setAudioBars(bars);

        // Simulate volume level
        const volumePercent = Math.random() * 30 + 10;
        audioViz.setVolumeLevel(volumePercent);

        requestAnimationFrame(animateBars);
      };

      animateBars();
      console.log("[MicBars] Simplified microphone bars started");
    } catch (error) {
      console.error("[MicBars] Error starting mic bars:", error);
      startSimulatedBars();
    }
  }, [permissions, audioViz]);

  // Simple simulated bars for fallback
  const startSimulatedBars = useCallback(() => {
    console.log("[MicBars] Starting simulated bars...");

    const simulateBars = () => {
      if (isCleaningUpRef.current) {
        return;
      }

      const bars = Array.from({ length: 32 }, () => Math.random() * 25 + 5);
      audioViz.setAudioBars(bars);

      const volumePercent = Math.random() * 15 + 5;
      audioViz.setVolumeLevel(volumePercent);

      requestAnimationFrame(simulateBars);
    };

    simulateBars();
  }, [audioViz]);

  const stopMicBars = useCallback(() => {
    // Prevent multiple calls to stopMicBars
    if (isCleaningUpRef.current) {
      return;
    }

    isCleaningUpRef.current = true;

    // Simple cleanup - just clear the bars
    audioViz.setAudioBars([]);
    audioViz.setVolumeLevel(0);

    console.log("[MicBars] Microphone bars stopped");
  }, [audioViz]);

  // Enhanced VAD setup with multilingual support
  useEffect(() => {
    if (!isStarted) return; // Only initialize VAD when started

    let vad: unknown = null;
    let isInitialized = false;
    let isCleaningUp = false;

    const initializeVAD = async () => {
      console.log("[VAD] Starting VAD initialization...");

      // Suppress ONNX Runtime warnings about unused initializers
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const message = args[0];
        if (
          typeof message === "string" &&
          (message.includes("Removing initializer") ||
            message.includes("CleanUnusedInitializersAndNodeArgs"))
        ) {
          return; // Suppress ONNX Runtime warnings
        }
        originalWarn.apply(console, args);
      };

      try {
        console.log("[VAD] Creating MicVAD instance...");
        vad = await MicVAD.new({
          onSpeechStart: () => {
            console.log("[VAD] Speech start detected");
            console.log("[VAD] Processing state:", isProcessingRef.current);
            console.log("[VAD] Cleaning up state:", isCleaningUp);
            console.log("[VAD] Current state:", state.value);
            console.log(
              "[VAD] Conversation active:",
              conversationActiveRef.current
            );

            if (isProcessingRef.current || isCleaningUp) {
              console.log(
                "[VAD] Speech start blocked - processing or cleaning up"
              );
              return;
            }

            // Natural barge-in: If TTS is playing, interrupt immediately
            if (audioVizRef.current?.isPlaying && isAudioPlaying) {
              console.log("[VAD] Speech start - interrupting TTS");
              handleInterruption();
              return;
            }

            // Prevent multiple speech start events
            if (state.matches("listening") || conversationActiveRef.current) {
              console.log(
                "[VAD] Speech start blocked - already listening or conversation active"
              );
              return;
            }

            // Ensure TTS is completely stopped before starting new speech
            cancelSpeech();

            // Lock audio context to prevent conflicts
            if (audioContextManagerRef.current) {
              audioContextManagerRef.current.lockAudioContext();
            }

            conversationActiveRef.current = true;
            // Reset sensitive error flag when user starts speaking again
            setIsListeningAfterSensitiveError(false);
            console.log("[VAD] Sending SPEECH_START event");
            if (sendRef.current) {
              sendRef.current({ type: "SPEECH_START" });
            }
            console.log(
              "[VAD] SPEECH_START event sent, new state:",
              state.value
            );

            // Start audio bars when user starts speaking
            if (startMicBarsRef.current) {
              startMicBarsRef.current();
            }
          },
          onSpeechEnd: async (audio) => {
            console.log(
              "[VAD] Speech end detected, audio length:",
              audio?.length || 0
            );
            console.log("[VAD] Processing state:", isProcessingRef.current);
            console.log("[VAD] Current state before speech end:", state.value);

            if (isProcessingRef.current || isCleaningUp) {
              console.log(
                "[VAD] Speech end blocked - processing or cleaning up"
              );
              return;
            }

            if (!audio || audio.length === 0) {
              console.log("[VAD] No audio data, sending SPEECH_END");
              send({ type: "SPEECH_END" });
              return;
            }

            console.log(
              "[VAD] Processing speech with audio length:",
              audio.length
            );
            console.log(
              "[VAD] Audio data sample:",
              Array.from(audio.slice(0, 10))
            );

            // Send SPEECH_END event immediately to transition to processing state
            console.log(
              "[VAD] Sending SPEECH_END event to transition to processing state"
            );
            send({ type: "SPEECH_END" });
            console.log(
              "[VAD] SPEECH_END event sent, current state:",
              state.value
            );

            isProcessingRef.current = true;
            conversationActiveRef.current = false;

            // Stop audio bars when user stops speaking
            if (stopMicBarsRef.current) {
              stopMicBarsRef.current();
            }

            // Add timeout to prevent stuck processing state
            const processingTimeout = setTimeout(() => {
              if (isProcessingRef.current) {
                console.log("[VAD] Processing timeout reached");
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                if (sendRef.current) {
                  debouncedSend({
                    type: "ERROR",
                    error: "Processing timeout - please try again"
                  });
                }
              }
            }, 60000); // 60 second timeout (increased from 30s)

            try {
              console.log("[VAD] Processing audio with HTTP API...");
              const wavData = float32ArrayToWav(audio);
              const audioBlob = new Blob([wavData], { type: "audio/wav" });

              console.log(
                "[VAD] Sending audio via HTTP, size:",
                audioBlob.size
              );
              console.log(
                "[VAD] Language being sent:",
                languagePrefsRef.current?.currentLanguage?.code || "en"
              );

              // Process with HTTP API
              try {
                const response = await httpVoiceService.processVoice(
                  audioBlob,
                  languagePrefsRef.current?.currentLanguage?.code || "en"
                );

                if (response.success && response.audioUrl) {
                  console.log(
                    "[VAD] Received audio response:",
                    response.audioUrl
                  );

                  // Clear processing timeout since we received a response
                  clearTimeout(processingTimeout);

                  // Handle audio response directly
                  if (response.audioUrl) {
                    handleAudioResponse({
                      audioUrl: response.audioUrl,
                      text: response.text,
                      language: response.language
                    });
                  } else {
                    console.error("[VAD] No audio URL in response");
                    debouncedSend({
                      type: "ERROR",
                      error: "No audio URL received from server"
                    });
                  }
                } else {
                  // Clear processing timeout since we received a response (even if failed)
                  clearTimeout(processingTimeout);

                  // Handle sensitive content error with user-friendly message
                  let errorMessage =
                    response.error || "Voice processing failed";

                  // If it's a sensitive content error, transition to listening state
                  if (errorMessage === "Unable to handle this query") {
                    console.log(
                      "[VAD] Sensitive content error detected, transitioning to listening state"
                    );
                    // Reset conversation state to allow new speech detection
                    conversationActiveRef.current = false;
                    isProcessingRef.current = false;

                    // Set flag to show friendly error message in listening state
                    setIsListeningAfterSensitiveError(true);

                    // For sensitive content errors, show friendly message and transition to listening
                    // This allows user to immediately try another question
                    debouncedSend({
                      type: "ERROR",
                      error: "Unable to handle this query"
                    });
                    // Then transition to listening state
                    debouncedSend({ type: "LISTEN" });
                  } else {
                    // Only log as error for non-sensitive content errors
                    console.error(
                      "[VAD] HTTP voice processing failed:",
                      response.error
                    );
                    // Send ERROR event for non-sensitive content errors
                    debouncedSend({
                      type: "ERROR",
                      error: errorMessage
                    });
                  }
                }
              } catch (error) {
                console.error("[VAD] HTTP request failed:", error);
                // Clear processing timeout since we received a response (even if failed)
                clearTimeout(processingTimeout);
                debouncedSend({ type: "ERROR", error: "HTTP request failed" });
              }
            } catch (error) {
              console.error("[VAD] Audio processing error:", error);
              debouncedSend({ type: "ERROR", error: "Audio processing error" });
              isProcessingRef.current = false;
            }
          },
          onVADMisfire: () => {
            console.log("[VAD] VAD misfire detected");
            if (isCleaningUp) return;
            send({ type: "INTERRUPT" });
          },
          positiveSpeechThreshold: 0.8,
          negativeSpeechThreshold: 0.3,
          preSpeechPadFrames: 10,
          frameSamples: 512,
          baseAssetPath: "/",
          onnxWASMBasePath: "/"
        });

        console.log("[VAD] MicVAD instance created successfully");

        // Restore original console.warn
        console.warn = originalWarn;

        isInitialized = true;
        vadRef.current = vad as { start: () => void; destroy: () => void };

        // Only start VAD if it's not paused
        if (!vadPausedRef.current) {
          console.log("[VAD] Starting VAD...");
          try {
            vadRef.current.start();
            console.log("[VAD] VAD started successfully");
          } catch (startError) {
            console.error("[VAD] Error starting VAD:", startError);
            debouncedSend({
              type: "ERROR",
              error: `VAD start failed: ${
                startError instanceof Error
                  ? startError.message
                  : "Unknown error"
              }`
            });
            return;
          }
          console.log("[VAD] VAD initialized and started");
        } else {
          console.log("[VAD] VAD initialized but paused");
        }

        send({ type: "READY" });
        debouncedSend({ type: "LISTEN" }); // Start listening immediately
        debouncedSend({ type: "CLEAR_ERROR" }); // Clear any previous errors

        // Start mic bars
        if (startMicBarsRef.current) {
          startMicBarsRef.current();
        }
        console.log("[VAD] VAD setup completed successfully");
      } catch (error) {
        console.error("[VAD] VAD initialization failed:", error);
        // Restore original console.warn in case of error
        console.warn = originalWarn;
        debouncedSend({
          type: "ERROR",
          error: `VAD initialization failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        });
      }
    };

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[VAD] Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    initializeVAD().catch((error) => {
      console.error("[VAD] VAD initialization error:", error);
      debouncedSend({
        type: "ERROR",
        error: `VAD error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      });
    });

    return () => {
      console.log("[VAD] Cleaning up VAD...");
      isCleaningUp = true;
      isProcessingRef.current = false;

      // Remove event listener
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );

      // Clear debounced send timeout
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
        stateUpdateTimeoutRef.current = null;
      }

      // Stop all audio bars
      try {
        if (stopAudioBarsRef.current) {
          stopAudioBarsRef.current();
        }
        if (stopMicBarsRef.current) {
          stopMicBarsRef.current();
        }
      } catch (error) {
        console.error("[VAD] Error stopping audio bars:", error);
      }

      // Stop any playing TTS using the audio player hook
      try {
        cancelSpeech();
      } catch (error) {
        console.error("[VAD] Error stopping TTS:", error);
      }

      // Stop all audio contexts
      if (audioContextManagerRef.current) {
        audioContextManagerRef.current.stopAllAudio();
      }

      // Destroy VAD with proper error handling
      if (vad && isInitialized) {
        try {
          console.log("[VAD] Destroying VAD instance...");
          (vad as { destroy: () => void }).destroy();
          console.log("[VAD] VAD instance destroyed");
        } catch (error) {
          console.error("[VAD] Error destroying VAD:", error);
        }
      }
      if (vadRef.current) {
        try {
          console.log("[VAD] Destroying VAD ref...");
          vadRef.current.destroy();
          console.log("[VAD] VAD ref destroyed");
        } catch (error) {
          console.error("[VAD] Error destroying VAD ref:", error);
        }
        vadRef.current = null;
      }
      console.log("[VAD] VAD cleanup completed");
    };
  }, [isStarted]); // Only depend on isStarted to prevent infinite re-renders

  const handleRequestPermissions = useCallback(async () => {
    console.log(
      "[Permissions] Requesting microphone and audio playback permissions..."
    );
    await permissions.requestAudioPermission();

    // Check if Safari needs audio permission
    if (permissions.needsSafariAudioUnlock) {
      setShowSafariAudioPermission(true);
      return;
    }

    // Also request audio playback permission for Safari compatibility
    await permissions.requestAudioPlaybackPermission();
    console.log("[Permissions] Permission requests completed");
  }, [permissions]);

  const handleSafariAudioPermissionGranted = useCallback(() => {
    setShowSafariAudioPermission(false);
    console.log("[Permissions] Safari audio permission granted");
  }, []);

  const handleCheckMediaDevices = useCallback(() => {
    permissions.checkMediaDevicesSupport();
  }, [permissions]);

  // Handle HTTP audio response directly
  const handleAudioResponse = useCallback(
    (response: { audioUrl: string; text?: string; language?: string }) => {
      try {
        // Track audio received performance
        trackPerformance("audio_received");

        if (
          response.audioUrl &&
          response.audioUrl !== "http://localhost:3000/" &&
          response.audioUrl !== "http://localhost:3000" &&
          response.audioUrl !== "http://localhost:3001/" &&
          response.audioUrl !== "http://localhost:3001" &&
          response.audioUrl !==
            "https://finance-advisor-frontend.suyesh.workers.dev/" &&
          !response.audioUrl.includes("localhost") &&
          !response.audioUrl.includes(
            "finance-advisor-frontend.suyesh.workers.dev"
          ) &&
          response.audioUrl.includes("r2.dev")
        ) {
          try {
            // Pause VAD before starting TTS
            pauseVAD();

            // Set up audio visualization and processing state
            audioViz.setIsInterruptible(true);

            // Reset processing state since we received a response from the server
            isProcessingRef.current = false;

            // Reset failed attempts counter on successful response
            failedAudioAttemptsRef.current = 0;

            // Use singleton audio player (like useMicrosoftSpeech pattern)
            playAudioFromUrl(
              response.audioUrl,
              // onEnd callback
              () => {
                console.log("[Audio] TTS playback completed");
                audioViz.setIsPlaying(false);
                audioViz.setIsInterruptible(false);
                stopAudioBars();
                // Clear sensitive error flag when audio playback completes successfully
                setIsListeningAfterSensitiveError(false);
                isProcessingRef.current = false;
                conversationActiveRef.current = false;

                // Resume VAD and transition back to listening
                setTimeout(() => {
                  resumeVAD();
                  debouncedSend({ type: "END" });
                  setTimeout(() => {
                    debouncedSend({ type: "LISTEN" });
                  }, 50);
                  debouncedSend({ type: "CLEAR_ERROR" });
                }, 100);
              },
              // onError callback
              () => {
                console.error("[Audio] TTS playback failed");
                audioViz.setIsPlaying(false);
                audioViz.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;

                // Resume VAD and transition back to listening
                setTimeout(() => {
                  resumeVAD();
                  debouncedSend({ type: "END" });
                  setTimeout(() => {
                    debouncedSend({ type: "LISTEN" });
                  }, 50);
                  debouncedSend({ type: "CLEAR_ERROR" });
                }, 100);
              }
            );

            // Set visualization state for audio playback
            audioViz.setIsPlaying(true);
            startAudioBars();

            // Track audio playback performance
            trackPerformance("audio_playback");

            // Transition to responding state since audio is starting
            send({ type: "RESPONSE_READY" });
          } catch (error) {
            console.error("[HTTP] Error handling audio response:", error);
            audioViz.setIsPlaying(false);
            audioViz.setIsInterruptible(false);
            stopAudioBars();
            isProcessingRef.current = false;
            conversationActiveRef.current = false;

            // Resume VAD and transition back to listening
            setTimeout(() => {
              resumeVAD();
              debouncedSend({ type: "LISTEN" });
              debouncedSend({ type: "CLEAR_ERROR" });
            }, 100);
          }
        } else {
          // Handle invalid or missing audio URL
          console.error(
            "[HTTP] Invalid audio URL received:",
            response.audioUrl
          );
          console.log("[HTTP] Skipping audio playback due to invalid URL");

          // Increment failed attempts counter
          failedAudioAttemptsRef.current += 1;

          // If we've had too many failed attempts, show an error
          if (failedAudioAttemptsRef.current >= 3) {
            console.error(
              "[HTTP] Too many failed audio attempts, showing error to user"
            );
            debouncedSend({
              type: "ERROR",
              error:
                "Audio service temporarily unavailable. Please try again later."
            });
            failedAudioAttemptsRef.current = 0; // Reset counter
          } else {
            // For the first few failures, simulate a successful response to prevent infinite loops
            console.log(
              "[HTTP] Simulating successful response to prevent infinite loop"
            );

            // Simulate audio playback for 3 seconds
            audioViz.setIsPlaying(true);
            startAudioBars();

            setTimeout(() => {
              audioViz.setIsPlaying(false);
              stopAudioBars();
              isProcessingRef.current = false;
              conversationActiveRef.current = false;

              // Resume VAD and transition back to listening
              setTimeout(() => {
                resumeVAD();
                debouncedSend({ type: "LISTEN" });
                debouncedSend({ type: "CLEAR_ERROR" });
              }, 100);
            }, 3000);

            return; // Don't proceed with the normal error handling
          }

          // Clean up state and resume VAD
          audioViz.setIsPlaying(false);
          audioViz.setIsInterruptible(false);
          stopAudioBars();
          isProcessingRef.current = false;
          conversationActiveRef.current = false;

          // Resume VAD and transition back to listening
          setTimeout(() => {
            resumeVAD();
            debouncedSend({ type: "LISTEN" });
            debouncedSend({ type: "CLEAR_ERROR" });
          }, 100);
        }
      } catch (error) {
        console.error("[HTTP] Error processing audio response:", error);
        audioViz.setIsPlaying(false);
        audioViz.setIsInterruptible(false);
        stopAudioBars();
        isProcessingRef.current = false;
        conversationActiveRef.current = false;

        // Resume VAD and transition back to listening
        setTimeout(() => {
          resumeVAD();
          debouncedSend({ type: "LISTEN" });
          debouncedSend({ type: "CLEAR_ERROR" });
        }, 100);
      }
    },
    [
      audioViz,
      startAudioBars,
      stopAudioBars,
      debouncedSend,
      pauseVAD,
      resumeVAD,
      playAudioFromUrl,
      send
    ]
  );

  const handleInterruption = useCallback(() => {
    const now = Date.now();

    // Prevent rapid successive interruptions
    if (now - lastInterruptionTimeRef.current < 500) {
      return;
    }

    lastInterruptionTimeRef.current = now;

    // Set processing flag to prevent new speech processing
    isProcessingRef.current = true;
    conversationActiveRef.current = false;

    // Force stop TTS playback completely using the audio player hook
    cancelSpeech();
    audioViz.setIsPlaying(false);
    audioViz.setIsInterruptible(false);
    stopAudioBars();

    // Unlock audio context
    audioContextManager.unlockAudioContext();

    // Update state to interrupted
    debouncedSend({ type: "INTERRUPT" });

    // Resume VAD after interruption with longer delay
    setTimeout(() => {
      resumeVAD();
      // Reset processing flag to allow new speech
      isProcessingRef.current = false;
    }, 500); // Increased delay to ensure proper cleanup
  }, [audioViz, stopAudioBars, debouncedSend, audioContextManager, resumeVAD]);

  /**
   * Enhanced start voice assistant with multilingual support
   *
   * Initializes the voice assistant by:
   * - Requesting microphone permissions
   * - Setting up audio context and VAD
   * - Configuring language-specific settings
   *
   * @returns {Promise<void>}
   * @throws {Error} When audio permission is denied or connection fails
   */
  const startVoiceAssistant = async () => {
    try {
      send({ type: "START" });
      send({ type: "CLEAR_ERROR" }); // Clear any previous errors

      // Request audio permission using the permissions hook
      const audioGranted = await permissions.requestAudioPermission();

      if (!audioGranted) {
        throw new Error(
          "Audio permission is required to use the voice assistant"
        );
      }

      // Request audio playback permission for Safari compatibility
      if (permissions.needsSafariAudioUnlock) {
        setShowSafariAudioPermission(true);
        return; // Don't proceed until permission is granted
      }
      await permissions.requestAudioPlaybackPermission();

      // Initialize audio context with user interaction
      try {
        await audioContextManager.initializeAudioContext();
      } catch (audioError) {
        console.warn("Audio context initialization failed:", audioError);
        // Continue anyway - it might work later
      }

      // Audio permission granted - ready to start

      // Unlock audio for Safari compatibility
      console.log("[VAD] Unlocking audio for Safari compatibility...");
      await unlockAudio();

      // Track performance start
      trackPerformance("connection_start");

      // HTTP mode: Initialize voice assistant
      console.log("[VAD] HTTP mode: Initializing voice assistant");

      setIsStarted(true);
      send({ type: "READY" });
      debouncedSend({ type: "CLEAR_ERROR" });

      // Start VAD listening immediately for HTTP mode
      if (vadRef.current) {
        vadRef.current.start();
      }

      // Transition to listening state
      send({ type: "LISTEN" });
    } catch (error) {
      debouncedSend({
        type: "ERROR",
        error: `Failed to start: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      });
    }
  };

  const stopVoiceAssistant = useCallback(() => {
    console.log("[VAD] Stopping voice assistant...");

    // Stop any playing audio
    cancelSpeech();

    // Stop VAD
    if (vadRef.current) {
      try {
        vadRef.current.destroy();
        vadRef.current = null;
      } catch (error) {
        console.error("[VAD] Error destroying VAD:", error);
      }
    }

    // Stop audio bars
    try {
      if (stopAudioBarsRef.current) {
        stopAudioBarsRef.current();
      }
      if (stopMicBarsRef.current) {
        stopMicBarsRef.current();
      }
    } catch (error) {
      console.error("[VAD] Error stopping audio bars:", error);
    }

    // Reset state
    setIsStarted(false);
    isProcessingRef.current = false;
    conversationActiveRef.current = false;
    vadPausedRef.current = false;

    // Reset audio visualization
    audioViz.setIsPlaying(false);
    audioViz.setIsInterruptible(false);
    audioViz.setAudioBars([]);
    audioViz.setVolumeLevel(0);

    // Transition to ready state - CANCEL goes to idle, then START to get to ready
    send({ type: "CANCEL" });
    send({ type: "START" });
    send({ type: "READY" });
    send({ type: "CLEAR_ERROR" });

    console.log("[VAD] Voice assistant stopped, returned to ready state");
  }, [cancelSpeech, audioViz, debouncedSend, send]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Safari Audio Permission Modal */}
      {showSafariAudioPermission && (
        <SafariAudioPermission
          permissions={permissions}
          onPermissionGranted={handleSafariAudioPermissionGranted}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-3xl">
        <div className="absolute inset-0 opacity-30">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${((i * 137.5) % 100) + (i % 3) * 0.5}%`,
                top: `${((i * 73.3) % 100) + (i % 5) * 0.3}%`,
                animationDelay: `${(i % 3) * 0.5 + (i % 2) * 0.25}s`,
                animationDuration: `${2 + (i % 3) * 0.5}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative bg-black/20 backdrop-blur-xl rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden">
        {!hasSelectedLanguage ? (
          // Enhanced Language Selection Screen with Dialect Support
          <div className="p-6">
            <LanguageSelection
              languages={getIndianLanguages()}
              onSelectLanguage={handleLanguageChange}
              onDialectChange={() => {}} // No dialect change handler
              isMobile={false}
            />
          </div>
        ) : (
          // Enhanced AI Agent Interface with Multilingual Support
          <>
            <Header
              languagePrefs={languagePrefs}
              audioViz={audioViz}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isProcessingState={isProcessingState}
            />

            <Greeting languagePrefs={languagePrefs} />

            <AudioVisualizer
              audioViz={audioViz}
              isListening={isListening}
              isSpeaking={isAudioPlaying}
            />

            <StatusDisplay
              status={status}
              isProcessingState={isProcessingState}
              audioViz={audioViz}
              isListeningAfterSensitiveError={isListeningAfterSensitiveError}
            />

            <PermissionsStatus
              permissions={permissions}
              handleRequestPermissions={handleRequestPermissions}
            />

            {vadError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
                <div className="text-red-300 text-sm">{vadError}</div>
              </div>
            )}

            <StartButton
              isStarted={isStarted}
              status={status}
              permissions={permissions}
              startVoiceAssistant={startVoiceAssistant}
              stopVoiceAssistant={stopVoiceAssistant}
              isListening={isListening}
            />

            {/* Enhanced Language Change Button with Dialect Info */}
            <div className="p-4 text-center border-t border-cyan-500/20">
              <button
                onClick={() => {
                  setHasSelectedLanguage(false);
                  send({ type: "CANCEL" });
                  setIsStarted(false);
                }}
                className="px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-base border border-purple-500/50"
              >
                Change Language
              </button>
              <p className="text-cyan-300/60 text-xs mt-2">
                Switch to a different language
              </p>
              {/* No dialect preference or user location to display here */}
            </div>
          </>
        )}
      </div>

      <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-3xl blur opacity-10 -z-10"></div>
    </div>
  );
}

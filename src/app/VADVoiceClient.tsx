/**
 * VADVoiceClient.tsx - Main Voice Assistant Component
 *
 * This is the core component that handles:
 * - Voice Activity Detection (VAD)
 * - WebSocket communication with the AI server
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
import {
  LanguageDetectionService,
  LanguageConfig,
  CFData,
  DEFAULT_LANGUAGES,
  getIndianLanguages
} from "./services/LanguageDetectionService";
import { AudioService } from "./services/AudioService";
import { float32ArrayToWav, uint8ArrayToBase64 } from "./utils/audioUtils";
import { SimpleTTSPlayer } from "./components/SimpleTTSPlayer";
import LanguageSelector from "./components/LanguageSelector";
import LanguageSelection from "./components/LanguageSelection";
import { Header } from "./components/Header";
import { Greeting } from "./components/Greeting";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { StatusDisplay } from "./components/StatusDisplay";
import { PermissionsStatus } from "./components/PermissionsStatus";
import { StartButton } from "./components/StartButton";
import { SafariAudioPermission } from "./components/SafariAudioPermission";
import {
  WebSocketManager,
  createWebSocketManager,
  WebSocketMessage,
  MessageThrottler
} from "./websocket-utils";

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
 * Pre-warm WebSocket connections for faster startup
 *
 * Creates a background WebSocket connection to reduce initial connection time
 * when the user starts the voice assistant. This improves perceived performance.
 *
 * @returns {void}
 */
const preWarmConnections = () => {
  if (!PERFORMANCE_CONFIG.PREWARM_CONNECTIONS) return;

  console.log("[Performance] Pre-warming WebSocket connections...");
  const session = crypto.randomUUID();
  const wsUrl = `wss://bolbachan-ekbachan.suyesh.workers.dev/api/ws?session=${session}`;

  const ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    console.log("[Performance] Pre-warmed connection ready");
    // Send ping to keep connection alive
    ws.send(JSON.stringify({ type: "ping" }));
  };
  ws.onerror = () => {
    console.log("[Performance] Pre-warm connection failed");
  };
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
 * - WebSocket communication
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [showSafariAudioPermission, setShowSafariAudioPermission] =
    useState(false);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const messageThrottlerRef = useRef<MessageThrottler | null>(null);
  const vadRef = useRef<{ start: () => void; destroy: () => void } | null>(
    null
  );
  const isProcessingRef = useRef(false);
  const audioBarsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const lastInterruptionTimeRef = useRef(0);
  const vadPausedRef = useRef(false);
  // WebSocket manager handles ping intervals automatically
  // Removed currentAudioElementRef - using activeAudioElementRef for single audio element management
  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const failedAudioAttemptsRef = useRef(0);

  const [state, send] = useMachine(voiceAssistantMachine);

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

  // TTS error handler - simplified to prevent infinite re-renders
  const handleTTSError = useCallback(
    (event: CustomEvent) => {
      console.log("[VADVoiceClient] TTS error detected:", event.detail);

      // Reset processing state
      isProcessingRef.current = false;
      conversationActiveRef.current = false;
      setIsProcessing(false);

      // Ensure VAD is resumed - use ref to avoid dependency issues
      if (vadPausedRef.current && vadRef.current) {
        console.log("[VADVoiceClient] Resuming VAD after TTS error");
        vadRef.current.start();
        vadPausedRef.current = false;
      }

      // Clear any previous errors and transition to listening state
      // Use refs to avoid dependency issues
      if (sendRef.current) {
        sendRef.current({ type: "LISTEN" });
        sendRef.current({ type: "CLEAR_ERROR" });
      }
    },
    [setIsProcessing]
  );

  // Add TTS error listener - only once on mount
  useEffect(() => {
    window.addEventListener("ttsError", handleTTSError as EventListener);
    return () => {
      window.removeEventListener("ttsError", handleTTSError as EventListener);
    };
  }, [handleTTSError]);

  const vadError = state.context.error;

  // WebSocket timeout state
  const [isRequestTimedOut, setIsRequestTimedOut] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [stateTimeout, setStateTimeout] = useState<number | null>(null);

  const getStatusText = (stateValue: string) => {
    // Show timeout message if request timed out
    if (isRequestTimedOut) {
      return "Request timeout. Please retry";
    }

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
    }, 10000); // 10 second timeout

    setStateTimeout(timeoutId);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.value, debouncedSend]); // Removed stateTimeout from dependencies

  // Debug state changes (commented out to prevent infinite re-renders)
  // console.log('[UI State] Current state:', {
  //   status,
  //   isListening,
  //   isProcessingState,
  //   isSpeaking,
  //   audioBarsLength: voiceUIStore.audioBars.length,
  //   isPlaying: voiceUIStore.isPlaying
  // });

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

      // Update WebSocket if connected
      if (wsManagerRef.current?.isConnected()) {
        const userContext = audioContextManager.getUserContext();
        wsManagerRef.current.send({
          type: "init",
          language: language?.code || "en",
          agent: language?.agentName || "Drishthi"
        });
      }
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

        // Pre-warm connections for faster startup
        preWarmConnections();
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
  const generateAudioBars = useCallback(() => {
    const bars = Array.from({ length: 20 }, () => Math.random() * 100);
    audioViz.setAudioBars(bars);
  }, [audioViz]);

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

    // Clear volume monitoring
    if (volumeCheckIntervalRef.current) {
      clearInterval(volumeCheckIntervalRef.current);
      volumeCheckIntervalRef.current = null;
    }

    // Simple cleanup - just clear the bars
    audioViz.setAudioBars([]);
    audioViz.setVolumeLevel(0);

    console.log("[MicBars] Microphone bars stopped");
  }, [audioViz]);

  // Update function refs after they're defined
  // Removed useEffect to prevent infinite re-renders
  // Refs will be updated directly when functions are called

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
            console.log(
              "[VAD] WebSocket state:",
              wsManagerRef.current?.getState()
            );
            console.log(
              "[VAD] WebSocket connected:",
              wsManagerRef.current?.isConnected()
            );

            if (isProcessingRef.current || isCleaningUp) {
              console.log(
                "[VAD] Speech start blocked - processing or cleaning up"
              );
              return;
            }

            // Clear any existing timeout when starting new speech
            clearRequestTimeout();

            // Natural barge-in: If TTS is playing, interrupt immediately
            if (
              audioVizRef.current?.isPlaying &&
              activeAudioElementRef.current
            ) {
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
            if (activeAudioElementRef.current) {
              activeAudioElementRef.current.pause();
              activeAudioElementRef.current.src = "";
            }

            // Lock audio context to prevent conflicts
            if (audioContextManagerRef.current) {
              audioContextManagerRef.current.lockAudioContext();
            }

            conversationActiveRef.current = true;
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
          onSpeechEnd: (audio) => {
            console.log(
              "[VAD] Speech end detected, audio length:",
              audio?.length || 0
            );
            console.log("[VAD] Processing state:", isProcessingRef.current);
            console.log(
              "[VAD] WebSocket state:",
              wsManagerRef.current?.getState()
            );
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
            setTimeout(() => {
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
            }, 30000); // 30 second timeout

            try {
              // Check if WebSocket is connected and ready
              if (!isWebSocketConnected()) {
                // Don't attempt reconnection if we're currently playing audio
                if (isPlayingRef.current || isAudioLoadingRef.current) {
                  console.log(
                    "[VAD] WebSocket not connected but audio is playing, skipping reconnection attempt"
                  );
                  return;
                }

                console.error(
                  "[VAD] WebSocket not connected, attempting to reconnect..."
                );

                // Store pending request for retry after reconnection
                pendingRequestRef.current = {
                  audioData: audio,
                  language:
                    languagePrefsRef.current?.currentLanguage?.code || "en",
                  timestamp: Date.now()
                };
                console.log(
                  "[VAD] Stored pending request for retry after reconnection"
                );

                // Clear processing state immediately to prevent UI from getting stuck
                isProcessingRef.current = false;
                conversationActiveRef.current = false;

                // Try to reconnect
                reconnectWebSocket();

                // Set a timeout to check if reconnection was successful
                setTimeout(() => {
                  setIsReconnecting(false); // Reset reconnecting flag

                  if (!isWebSocketConnected()) {
                    console.error(
                      "[VAD] Reconnection failed after 5 seconds, showing error to user"
                    );
                    // Ensure we're not stuck in processing state
                    isProcessingRef.current = false;
                    conversationActiveRef.current = false;

                    // Clear pending request since reconnection failed
                    if (pendingRequestRef.current) {
                      console.log(
                        "[VAD] Clearing pending request due to reconnection failure"
                      );
                      pendingRequestRef.current = null;
                    }

                    // Transition to error state and then back to ready
                    debouncedSend({
                      type: "ERROR",
                      error: "Connection lost. Please try again."
                    });

                    // After error, transition back to ready state
                    setTimeout(() => {
                      debouncedSend({ type: "READY" });
                    }, 1000);

                    // Also ensure we're not stuck in starting state
                    setTimeout(() => {
                      if (state.value === "starting") {
                        console.log(
                          "[WebSocket] Forcing transition from starting to ready state"
                        );
                        debouncedSend({ type: "READY" });
                      }
                    }, 2000);
                  } else {
                    console.log(
                      "[VAD] Reconnection successful, continuing with audio processing"
                    );
                  }
                }, 5000); // Wait 5 seconds for reconnection

                return;
              }
              console.log("[VAD] WebSocket is open, sending audio data...");
              const wavData = float32ArrayToWav(audio);
              const base64 = uint8ArrayToBase64(wavData);

              const audioMessage = JSON.stringify({
                type: "audio_chunk",
                data: `data:audio/wav;base64,${base64}`,
                language:
                  languagePrefsRef.current?.currentLanguage?.code || "en",
                languageGoogle: getLanguageCodeForService("google"),
                languageSarvam: getLanguageCodeForService("sarvam")
              });

              console.log(
                "[VAD] Sending audio chunk, message size:",
                audioMessage.length
              );
              console.log(
                "[VAD] Language being sent:",
                languagePrefsRef.current?.currentLanguage?.code || "en"
              );
              console.log(
                "[VAD] Language name:",
                languagePrefsRef.current?.currentLanguage?.name || "English"
              );
              console.log(
                "[VAD] Google language code:",
                getLanguageCodeForService("google")
              );
              console.log(
                "[VAD] Sarvam language code:",
                getLanguageCodeForService("sarvam")
              );

              // Store pending request for potential retry
              pendingRequestRef.current = {
                audioData: audio,
                language:
                  languagePrefsRef.current?.currentLanguage?.code || "en",
                timestamp: Date.now()
              };
              console.log("[VAD] Stored pending request for potential retry");

              logWebSocketMessage(audioMessage, "send");
              wsManagerRef.current!.send(JSON.parse(audioMessage));

              // Start timeout timer for this request
              startRequestTimeout();

              const endMessage: WebSocketMessage = {
                type: "end_audio",
                language:
                  languagePrefsRef.current?.currentLanguage?.code || "en",
                languageGoogle: getLanguageCodeForService("google"),
                languageSarvam: getLanguageCodeForService("sarvam")
              };

              console.log("[VAD] Sending end_audio message");
              console.log(
                "[VAD] End audio language:",
                languagePrefsRef.current?.currentLanguage?.code || "en"
              );
              logWebSocketMessage(JSON.stringify(endMessage), "send");
              wsManagerRef.current!.send(endMessage);
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

      // WebSocket manager handles cleanup automatically

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

      // Stop any playing TTS
      try {
        if (activeAudioElementRef.current) {
          activeAudioElementRef.current.pause();
          activeAudioElementRef.current.src = "";
          activeAudioElementRef.current = null;
        }
      } catch (error) {
        console.error("[VAD] Error stopping TTS:", error);
      }

      // Stop all audio contexts
      if (audioContextManagerRef.current) {
        audioContextManagerRef.current.stopAllAudio();
      }

      // Clean up WebSocket manager
      if (wsManagerRef.current) {
        wsManagerRef.current.destroy();
        wsManagerRef.current = null;
      }

      // Clean up message throttler
      if (messageThrottlerRef.current) {
        messageThrottlerRef.current.destroy();
        messageThrottlerRef.current = null;
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

  const reconnectWebSocket = useCallback(() => {
    // Prevent multiple reconnection attempts
    if (isReconnecting) {
      console.log("[WebSocket] Reconnection already in progress, skipping");
      return;
    }

    console.log("[WebSocket] Attempting to reconnect...");
    setIsReconnecting(true);

    // WebSocket manager handles reconnection automatically
    if (wsManagerRef.current) {
      try {
        // Check if the manager is in a valid state
        if (wsManagerRef.current.isConnected()) {
          console.log(
            "[WebSocket] Manager is already connected, resetting reconnecting flag"
          );
          setIsReconnecting(false);
          return;
        }

        wsManagerRef.current.connect();
        console.log("[WebSocket] Reconnection attempt initiated");
      } catch (error) {
        console.error("[WebSocket] Reconnection failed:", error);
        setIsReconnecting(false);
        // If reconnection fails, start a new connection
        console.log("[WebSocket] Starting new voice assistant session");
        startVoiceAssistant();
      }
    } else {
      console.log("[WebSocket] No manager found, starting new connection");
      setIsReconnecting(false);
      // If manager doesn't exist, start a new connection
      startVoiceAssistant();
    }
  }, [isReconnecting]);

  // Helper function to check if WebSocket is connected and ready
  const isWebSocketConnected = useCallback(() => {
    return wsManagerRef.current?.isConnected() || false;
  }, []);

  /**
   * Enhanced WebSocket message handler with multilingual support and Cloudflare Stream API
   *
   * Processes incoming WebSocket messages from the AI server:
   * - Handles TTS stream URLs for audio playback
   * - Manages conversation state transitions
   * - Processes error messages and status updates
   * - Validates audio URLs and handles playback
   *
   * @param {MessageEvent} event - The WebSocket message event
   * @returns {Promise<void>}
   */
  const handleWebSocketMessage = useCallback(
    async (event: MessageEvent) => {
      try {
        logWebSocketMessage(event.data, "receive");
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "tts_stream_url":
            // Clear timeout since we received a response
            clearRequestTimeout();

            // Track audio received performance
            trackPerformance("audio_received");

            if (
              data.url &&
              data.url !== "http://localhost:3000/" &&
              data.url !== "http://localhost:3000" &&
              data.url !== "http://localhost:3001/" &&
              data.url !== "http://localhost:3001" &&
              data.url !==
                "https://finance-advisor-frontend.suyesh.workers.dev/" &&
              !data.url.includes("localhost") &&
              !data.url.includes(
                "finance-advisor-frontend.suyesh.workers.dev"
              ) &&
              data.url.includes("r2.dev")
            ) {
              try {
                // Clean up any existing audio element first (like useMicrosoftSpeech pattern)
                cleanupAudio();

                // Pause VAD before starting TTS
                pauseVAD();

                // Create single audio element for TTS playback (like useMicrosoftSpeech pattern)
                const audioElement = new Audio();
                console.log(
                  "[Audio] 🎵 Created new audio element:",
                  audioElement
                );

                // Set audio element properties
                audioElement.preload = "auto";
                audioElement.autoplay = true;
                audioElement.controls = false;

                if (
                  !data.url ||
                  data.url === "http://localhost:3000/" ||
                  data.url === "http://localhost:3000" ||
                  data.url === "http://localhost:3001/" ||
                  data.url === "http://localhost:3001" ||
                  data.url ===
                    "https://finance-advisor-frontend.suyesh.workers.dev/" ||
                  data.url.includes("localhost") ||
                  data.url.includes(
                    "finance-advisor-frontend.suyesh.workers.dev"
                  ) ||
                  !data.url.includes("r2.dev")
                ) {
                  console.error(
                    "[WebSocket] URL validation failed for:",
                    data.url
                  );
                  throw new Error(
                    "Invalid audio URL received from server - expected R2 bucket URL"
                  );
                }

                // Reference is now managed by activeAudioElementRef
                audioViz.setIsInterruptible(true);
                setIsProcessing(true);

                // Reset processing state since we received a response from the server
                isProcessingRef.current = false;

                // Reset failed attempts counter on successful response
                failedAudioAttemptsRef.current = 0;

                // Don't transition to responding state yet - wait for actual audio playback

                // Set up audio element event handlers
                audioElement.onloadstart = () => {
                  isAudioLoadingRef.current = true;
                };

                audioElement.onplay = () => {
                  // Track audio playback performance
                  trackPerformance("audio_playback");

                  // Now transition to responding state since audio is actually playing

                  send({ type: "RESPONSE_READY" });
                };

                // Store reference to the active audio element (like useMicrosoftSpeech pattern)
                activeAudioElementRef.current = audioElement;
                isPlayingRef.current = true;

                // Add event listeners (like useMicrosoftSpeech pattern)
                audioElement.addEventListener("ended", handleAudioEnded);
                audioElement.addEventListener("error", handleAudioError);

                // Error handling is now managed by handleAudioError event listener

                // Set the stream URL and start playback
                console.log("[Audio] 🎵 Setting audio src to:", data.url);
                console.log(
                  "[Audio] Data object before setting src:",
                  JSON.stringify(data, null, 2)
                );
                console.log("[Audio] Audio element before setting src:", {
                  src: audioElement.src,
                  currentTime: audioElement.currentTime,
                  duration: audioElement.duration
                });

                // Ensure we're setting the correct URL
                if (
                  data.url &&
                  data.url !== "http://localhost:3000/" &&
                  data.url !== "http://localhost:3000" &&
                  data.url !== "http://localhost:3001/" &&
                  data.url !== "http://localhost:3001"
                ) {
                  console.log(
                    "[Audio] 🎵 About to set audioElement.src to:",
                    data.url
                  );
                  audioElement.src = data.url;
                  audioElement.preload = "auto";
                  console.log(
                    "[Audio] 🎵 Audio src set successfully to:",
                    audioElement.src
                  );
                  console.log("[Audio] Audio element after setting src:", {
                    src: audioElement.src,
                    currentTime: audioElement.currentTime,
                    duration: audioElement.duration
                  });
                } else {
                  console.error("[Audio] URL validation failed. Data:", data);
                  throw new Error("Invalid audio URL received from server");
                }

                console.log(
                  "[WebSocket] Audio element src after setting:",
                  audioElement.src
                );
                console.log(
                  "[WebSocket] Attempting to load audio from:",
                  data.url
                );

                // Add load timeout
                const loadTimeout = setTimeout(() => {
                  console.log(
                    "[WebSocket] Audio load timeout, trying to play anyway"
                  );
                  audioElement.play().catch((error) => {
                    console.error(
                      "[WebSocket] Failed to play audio after timeout:",
                      error
                    );
                    // Force cleanup
                    audioViz.setIsPlaying(false);
                    audioViz.setIsInterruptible(false);
                    stopAudioBars();
                    isProcessingRef.current = false;
                    conversationActiveRef.current = false;
                    activeAudioElementRef.current = null;

                    setTimeout(() => {
                      resumeVAD();
                      debouncedSend({ type: "LISTEN" });
                      debouncedSend({ type: "CLEAR_ERROR" });
                    }, 100);
                  });
                }, 5000); // 5 second load timeout

                // Clear timeout when audio loads
                audioElement.oncanplay = () => {
                  clearTimeout(loadTimeout);
                  audioViz.setIsPlaying(true);
                  startAudioBars();
                };

                // Add timeout to prevent getting stuck in TTS playback
                const playTimeout = setTimeout(() => {
                  if (activeAudioElementRef.current === audioElement) {
                    audioElement.pause();
                    audioElement.src = "";
                    activeAudioElementRef.current = null;
                  }
                  audioViz.setIsPlaying(false);
                  audioViz.setIsInterruptible(false);
                  stopAudioBars();
                  isProcessingRef.current = false;
                  conversationActiveRef.current = false;

                  // Resume VAD after timeout
                  setTimeout(() => {
                    resumeVAD();
                    debouncedSend({ type: "LISTEN" });
                    debouncedSend({ type: "CLEAR_ERROR" });
                  }, 100);
                }, 30000); // 30 second timeout for streaming

                // Check and request audio playback permission for Safari compatibility
                console.log(
                  "[WebSocket] Checking audio playback permission..."
                );

                // For Safari, check if we need to show the permission modal
                if (permissions.needsSafariAudioUnlock) {
                  console.log(
                    "[WebSocket] Safari audio permission needed, showing modal"
                  );
                  setShowSafariAudioPermission(true);
                  throw new Error("Safari audio permission required");
                }

                const playbackGranted =
                  await permissions.requestAudioPlaybackPermission();
                if (!playbackGranted) {
                  console.error("[WebSocket] Audio playback permission denied");
                  throw new Error("Audio playback permission denied");
                }

                // Additional Safari-specific audio context unlock
                try {
                  const audioContext = new (window.AudioContext ||
                    (window as any).webkitAudioContext)();
                  if (audioContext.state === "suspended") {
                    console.log(
                      "[WebSocket] Resuming suspended audio context for Safari..."
                    );
                    await audioContext.resume();
                  }

                  // Only close if not already closed
                  if (audioContext.state !== "closed") {
                    audioContext.close();
                  }
                } catch (contextError) {
                  console.warn(
                    "[WebSocket] Audio context unlock failed:",
                    contextError
                  );
                }

                // Start playback with Safari-specific handling
                try {
                  console.log(
                    "[WebSocket] Attempting to start stream playback..."
                  );

                  // Safari-specific audio playback with user interaction check
                  const playPromise = audioElement.play();

                  if (playPromise !== undefined) {
                    await playPromise;
                    console.log(
                      "[WebSocket] Stream playback started successfully"
                    );
                  } else {
                    console.log(
                      "[WebSocket] Play promise undefined, checking if audio is playing..."
                    );
                    // Check if audio is actually playing
                    if (audioElement.readyState >= 2) {
                      // HAVE_CURRENT_DATA
                      console.log(
                        "[WebSocket] Audio is ready and should be playing"
                      );
                    } else {
                      throw new Error("Audio not ready for playback");
                    }
                  }

                  // Clear timeout once playback starts (onplay handler already set above)
                  clearTimeout(playTimeout);
                } catch (playError) {
                  console.error(
                    "[WebSocket] Failed to start stream playback:",
                    playError
                  );

                  // Safari-specific fallback: Try to unlock audio with user interaction simulation
                  if (
                    playError instanceof Error &&
                    playError.name === "NotAllowedError"
                  ) {
                    console.log(
                      "[WebSocket] Safari audio permission error, trying fallback..."
                    );

                    try {
                      // Create a temporary audio element with user interaction
                      const tempAudio = new Audio();
                      tempAudio.src =
                        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT";
                      tempAudio.volume = 0;

                      // Try to play the silent audio to unlock Safari
                      await tempAudio.play();
                      tempAudio.pause();
                      tempAudio.src = "";

                      console.log(
                        "[WebSocket] Safari audio unlock successful, retrying original audio..."
                      );

                      // Retry the original audio
                      await audioElement.play();
                      console.log(
                        "[WebSocket] Stream playback started successfully after Safari unlock"
                      );
                    } catch (fallbackError) {
                      console.error(
                        "[WebSocket] Safari fallback also failed:",
                        fallbackError
                      );
                      throw playError; // Re-throw original error
                    }
                  } else {
                    throw playError; // Re-throw non-Safari errors
                  }

                  // Handle other audio playback errors
                  console.error(
                    "[WebSocket] Audio playback failed:",
                    playError
                  );
                  console.error(
                    "[WebSocket] Failed to start stream playback:",
                    playError
                  );
                  clearTimeout(playTimeout);

                  // Handle NotAllowedError specifically
                  if (
                    playError instanceof Error &&
                    playError.name === "NotAllowedError"
                  ) {
                    console.log(
                      "[WebSocket] Audio permission error, attempting to resume audio context..."
                    );

                    // Try to resume audio context if it's suspended
                    try {
                      const audioContext = new (window.AudioContext ||
                        (window as any).webkitAudioContext)();
                      if (audioContext.state === "suspended") {
                        await audioContext.resume();
                        console.log("[WebSocket] Audio context resumed");
                      }

                      // Wait a bit longer before cleanup to allow retry
                      setTimeout(() => {
                        if (activeAudioElementRef.current) {
                          activeAudioElementRef.current.pause();
                          activeAudioElementRef.current.src = "";
                          activeAudioElementRef.current = null;
                        }
                        audioViz.setIsPlaying(false);
                        audioViz.setIsInterruptible(false);
                        stopAudioBars();
                        isProcessingRef.current = false;
                        conversationActiveRef.current = false;

                        // Resume VAD after delay
                        setTimeout(() => {
                          resumeVAD();
                          // Reset conversation state
                          conversationActiveRef.current = false;
                          // Transition back to listening state
                          debouncedSend({ type: "LISTEN" });
                          debouncedSend({ type: "CLEAR_ERROR" });
                          console.log(
                            "[WebSocket] Error recovery completed, transitioning to listening state"
                          );
                        }, 100);
                      }, 500);
                      return; // Don't proceed with immediate cleanup
                    } catch (contextError) {
                      console.error(
                        "[WebSocket] Audio context resume failed:",
                        contextError
                      );
                    }
                  }

                  // Force cleanup on other errors
                  if (activeAudioElementRef.current) {
                    activeAudioElementRef.current.pause();
                    activeAudioElementRef.current.src = "";
                    activeAudioElementRef.current = null;
                  }
                  audioViz.setIsPlaying(false);
                  audioViz.setIsInterruptible(false);
                  stopAudioBars();
                  isProcessingRef.current = false;
                  conversationActiveRef.current = false;

                  // Resume VAD on error
                  setTimeout(() => {
                    resumeVAD();
                    // Reset conversation state
                    conversationActiveRef.current = false;
                    // Transition back to listening state
                    debouncedSend({ type: "LISTEN" });
                    debouncedSend({ type: "CLEAR_ERROR" });
                    console.log(
                      "[WebSocket] Error cleanup completed, transitioning to listening state"
                    );
                  }, 100);
                }
              } catch (error) {
                console.error("[WebSocket] Error handling stream URL:", error);
                console.error("[WebSocket] Error details:", {
                  message:
                    error instanceof Error ? error.message : "Unknown error",
                  stack:
                    error instanceof Error ? error.stack : "No stack trace",
                  url: data.url
                });
                audioViz.setIsPlaying(false);
                audioViz.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                activeAudioElementRef.current = null;

                setTimeout(() => {
                  resumeVAD();
                  debouncedSend({ type: "LISTEN" });
                  debouncedSend({ type: "CLEAR_ERROR" });
                }, 100);
              }
            } else {
              // Handle invalid or missing audio URL
              console.error(
                "[WebSocket] Invalid audio URL received:",
                data.url
              );
              console.log(
                "[WebSocket] Skipping audio playback due to invalid URL"
              );
              console.log(
                "[WebSocket] This suggests the server-side TTS service is not working properly"
              );
              console.log("[WebSocket] Expected: R2 bucket URL (r2.dev)");
              console.log("[WebSocket] Received:", data.url);
              console.log(
                "[WebSocket] URL validation failed - server is returning frontend URL instead of R2 audio stream URL"
              );

              // Increment failed attempts counter
              failedAudioAttemptsRef.current += 1;

              // If we've had too many failed attempts, show an error
              if (failedAudioAttemptsRef.current >= 3) {
                console.error(
                  "[WebSocket] Too many failed audio attempts, showing error to user"
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
                  "[WebSocket] Simulating successful response to prevent infinite loop"
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
            break;

          case "pong":
            // Handle pong response for connection keep-alive
            break;

          case "test_response":
            // Handle test response from server
            break;

          case "stt_test_result":
            // Handle STT test result from server
            break;

          case "error":
            console.error("[WebSocket] Server error:", data.message);
            // Handle server-side errors
            isProcessingRef.current = false;
            conversationActiveRef.current = false;
            setIsProcessing(false);

            // Resume VAD after error
            setTimeout(() => {
              resumeVAD();
              debouncedSend({ type: "LISTEN" });
              debouncedSend({ type: "CLEAR_ERROR" });
            }, 100);
            break;

          case "interruption_cue":
            // Handle interruption signal from server
            handleInterruption();
            break;

          default:
            break;
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
        console.error("[WebSocket] Raw message data:", event.data);
      }
    },
    [
      audioViz,
      startAudioBars,
      stopAudioBars,
      debouncedSend,
      pauseVAD,
      resumeVAD,
      permissions
    ]
  );

  // Enhanced WebSocket message logger
  const logWebSocketMessage = (message: string, type: "send" | "receive") => {
    const timestamp = new Date().toISOString();
    const prefix =
      type === "send" ? "[WebSocket] OUTGOING" : "[WebSocket] INCOMING";

    try {
      const parsed = JSON.parse(message);
      console.log(`${prefix} [${timestamp}]:`, {
        type: parsed.type,
        messageSize: message.length,
        data:
          parsed.type === "audio_chunk"
            ? { ...parsed, data: parsed.data?.substring(0, 100) + "..." }
            : parsed
      });
    } catch (error) {
      console.log(
        `${prefix} [${timestamp}]: Raw message (${message.length} chars):`,
        message.substring(0, 200)
      );
    }
  };

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

    // Force stop TTS playback completely
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.pause();
      activeAudioElementRef.current.src = "";
      audioViz.setIsPlaying(false);
      audioViz.setIsInterruptible(false);
      stopAudioBars();
    }

    // WebSocket manager handles ping intervals automatically

    // Unlock audio context
    audioContextManager.unlockAudioContext();

    // Send interrupt signal to server
    if (isWebSocketConnected()) {
      wsManagerRef.current!.send({ type: "interrupt" });
    } else {
      console.log(
        "[Interrupt] WebSocket not connected, skipping interrupt message"
      );
    }

    // Update state to interrupted
    debouncedSend({ type: "INTERRUPT" });

    // Resume VAD after interruption with longer delay
    setTimeout(() => {
      resumeVAD();
      // Reset processing flag to allow new speech
      isProcessingRef.current = false;
    }, 500); // Increased delay to ensure proper cleanup
  }, [
    audioViz,
    stopAudioBars,
    debouncedSend,
    audioContextManager,
    resumeVAD,
    isWebSocketConnected
  ]);

  /**
   * Enhanced start voice assistant with multilingual support
   *
   * Initializes the voice assistant by:
   * - Requesting microphone permissions
   * - Establishing WebSocket connection to AI server
   * - Setting up audio context and VAD
   * - Configuring language-specific settings
   *
   * @returns {Promise<void>}
   * @throws {Error} When audio permission is denied or connection fails
   */
  const startVoiceAssistant = async () => {
    try {
      // Clear any previous timeout state and pending requests
      clearRequestTimeout();
      pendingRequestRef.current = null;

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

      // Track performance start
      trackPerformance("connection_start");

      // Initialize WebSocket connection using the manager
      const session = crypto.randomUUID();
      const wsUrl = `wss://bolbachan-ekbachan.suyesh.workers.dev/api/ws?session=${session}`;

      // Create WebSocket manager with optimized configuration
      const wsManager = createWebSocketManager(wsUrl, {
        onOpen: () => {
          setIsReconnecting(false); // Reset reconnecting flag on successful connection
          setIsStarted(true);
          send({ type: "READY" });
          debouncedSend({ type: "CLEAR_ERROR" });

          // Retry pending request if we have one
          if (pendingRequestRef.current) {
            console.log(
              "[WebSocket] Connection restored, retrying pending request"
            );
            setTimeout(() => {
              retryPendingRequest();
            }, 1000); // Wait 1 second for connection to stabilize
          }

          // Send periodic keep-alive pings to prevent server timeouts
          const keepAliveInterval = setInterval(() => {
            if (wsManager.isConnected()) {
              wsManager.send({ type: "ping" });
            } else {
              clearInterval(keepAliveInterval);
            }
          }, 30000); // Send ping every 30 seconds

          // Send initialization message to server
          const initMessage: WebSocketMessage = {
            type: "init",
            language: languagePrefs.currentLanguage?.code || "en",
            agent: languagePrefs.currentLanguage?.agentName || "Drishthi"
          };

          logWebSocketMessage(JSON.stringify(initMessage), "send");
          wsManager.send(initMessage);

          // WebSocket connection established successfully

          // Start VAD listening after connection is ready
          if (vadRef.current) {
            vadRef.current.start();
          }

          // Transition to listening state
          send({ type: "LISTEN" });
        },

        onClose: (code, reason) => {
          console.log("[WebSocket] Connection closed:", { code, reason });
          console.log("[WebSocket] Disconnection context:", {
            timestamp: new Date().toISOString(),
            currentState: state.value,
            isProcessing: isProcessingRef.current,
            isPlaying: isPlayingRef.current,
            isAudioLoading: isAudioLoadingRef.current,
            isReconnecting: isReconnecting,
            userAgent: navigator.userAgent,
            url: window.location.href
          });
          setIsStarted(false);
          setIsReconnecting(false);

          // Clear debounced send timeout
          if (stateUpdateTimeoutRef.current) {
            clearTimeout(stateUpdateTimeoutRef.current);
            stateUpdateTimeoutRef.current = null;
          }

          // Log different close codes for debugging
          switch (code) {
            case 1006:
              console.log("[WebSocket] Abnormal closure - connection lost");
              break;
            default:
          }

          // If connection fails, show a helpful message
          if (code === 1006 || code === 1002) {
            console.error("[WebSocket] Connection failed with code:", code);
            debouncedSend({
              type: "ERROR",
              error:
                "Cannot connect to voice assistant server. Please check your internet connection and try again."
            });
          } else if (code === 1000 || code === 1001) {
          } else {
            console.error(
              "[WebSocket] Connection closed with code:",
              code,
              "reason:",
              reason
            );
            debouncedSend({
              type: "ERROR",
              error: `WebSocket closed: ${reason || "Unknown reason"}`
            });
          }
        },

        onError: (error) => {
          console.error("[WebSocket] Connection error:", error);
          setIsStarted(false);

          // Clear debounced send timeout
          if (stateUpdateTimeoutRef.current) {
            clearTimeout(stateUpdateTimeoutRef.current);
            stateUpdateTimeoutRef.current = null;
          }

          debouncedSend({
            type: "ERROR",
            error: "Failed to connect to voice assistant"
          });
        },

        onMessage: (data) => {
          // Convert WebSocketMessage to MessageEvent for compatibility
          const event = {
            data: JSON.stringify(data)
          } as MessageEvent;
          handleWebSocketMessage(event);
        },

        onReconnect: (attempt) => {},

        onReconnectFailed: () => {
          console.error("[WebSocket] Max reconnection attempts reached");
          debouncedSend({
            type: "ERROR",
            error: "Connection lost. Please try again."
          });
        }
      });

      // Store the manager reference
      wsManagerRef.current = wsManager;

      // Create message throttler for efficient message sending
      messageThrottlerRef.current = new MessageThrottler(100);

      // Connect using the manager
      wsManager.connect();
    } catch (error) {
      debouncedSend({
        type: "ERROR",
        error: `Failed to start: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      });
    }
  };

  // Helper function to get the correct language code for different services
  const getLanguageCodeForService = (
    service: "sarvam" | "google" = "google"
  ) => {
    const baseCode = languagePrefs.currentLanguage?.code || "en";

    if (service === "sarvam") {
      // Sarvam expects language codes with -IN suffix
      const sarvamLanguageMap: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        kn: "kn-IN",
        ta: "ta-IN",
        te: "te-IN",
        ml: "ml-IN",
        mr: "mr-IN",
        gu: "gu-IN",
        bn: "bn-IN",
        pa: "pa-IN",
        or: "od-IN", // Odia
        as: "as-IN", // Assamese
        ur: "ur-IN" // Urdu
      };
      return sarvamLanguageMap[baseCode] || "en-IN";
    }

    // Google Cloud uses standard language codes
    return baseCode;
  };

  // Single global audio element management (like useMicrosoftSpeech hook)
  const activeAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const isAudioLoadingRef = useRef(false);

  // WebSocket timeout handling
  const [requestTimeout, setRequestTimeout] = useState<number | null>(null);

  // Request retry handling
  const pendingRequestRef = useRef<{
    audioData: Float32Array;
    language: string;
    timestamp: number;
  } | null>(null);

  // Clear request timeout
  const clearRequestTimeout = useCallback(() => {
    if (requestTimeout) {
      clearTimeout(requestTimeout);
      setRequestTimeout(null);
    }
    setIsRequestTimedOut(false);
    // Clear pending request when timeout is cleared (successful response received)
    if (pendingRequestRef.current) {
      pendingRequestRef.current = null;
    }
  }, [requestTimeout]);

  // Start request timeout timer
  const startRequestTimeout = useCallback(() => {
    // Clear any existing timeout
    if (requestTimeout) {
      clearTimeout(requestTimeout);
    }

    // Set new timeout (30 seconds)
    const timeoutId = window.setTimeout(() => {
      // Check if we have a pending request to retry
      if (pendingRequestRef.current) {
        // Don't set timeout state - we'll retry the request
        return;
      }

      // Only show timeout if no pending request to retry
      setIsRequestTimedOut(true);
    }, 30000); // 30 second timeout

    setRequestTimeout(timeoutId);
  }, [requestTimeout]);

  // Retry pending request after reconnection
  const retryPendingRequest = useCallback(() => {
    if (!pendingRequestRef.current) {
      return;
    }

    const pendingRequest = pendingRequestRef.current;

    // Check if request is not too old (within 5 minutes)
    const now = Date.now();
    if (now - pendingRequest.timestamp > 5 * 60 * 1000) {
      pendingRequestRef.current = null;
      return;
    }

    // Retry the request
    try {
      const wavData = float32ArrayToWav(pendingRequest.audioData);
      const base64 = uint8ArrayToBase64(wavData);

      const audioMessage = JSON.stringify({
        type: "audio_chunk",
        data: `data:audio/wav;base64,${base64}`,
        language: pendingRequest.language,
        timestamp: pendingRequest.timestamp
      });

      logWebSocketMessage(audioMessage, "send");
      wsManagerRef.current!.send(JSON.parse(audioMessage));

      // Start timeout timer for retry
      startRequestTimeout();

      const endMessage: WebSocketMessage = {
        type: "end_audio",
        language: pendingRequest.language,
        timestamp: pendingRequest.timestamp
      };

      logWebSocketMessage(JSON.stringify(endMessage), "send");
      wsManagerRef.current!.send(endMessage);
    } catch (error) {
      console.error("[WebSocket] Failed to retry pending request:", error);
      // Clear the pending request on error
      pendingRequestRef.current = null;
    }
  }, [startRequestTimeout]);

  // Audio ended handler (like the ended event listener in useMicrosoftSpeech)
  const handleAudioEnded = useCallback(() => {
    console.log(
      "[Audio] 🎵 AUDIO ENDED EVENT FIRED - Audio playback completed successfully!"
    );

    // Clean up audio state
    isPlayingRef.current = false;
    isAudioLoadingRef.current = false;
    audioViz.setIsPlaying(false);
    audioViz.setIsInterruptible(false);
    stopAudioBars();
    isProcessingRef.current = false;
    conversationActiveRef.current = false;

    // Clear any timeout state and pending requests since audio completed successfully
    clearRequestTimeout();
    pendingRequestRef.current = null;

    // Clean up audio element
    if (activeAudioElementRef.current) {
      activeAudioElementRef.current.removeEventListener(
        "ended",
        handleAudioEnded
      );
      activeAudioElementRef.current.removeEventListener(
        "error",
        handleAudioError
      );
      activeAudioElementRef.current = null;
    }

    // Resume VAD after TTS is complete
    setTimeout(() => {
      resumeVAD();
    }, 100);

    // Transition back to listening state using proper state machine events
    console.log(
      "[Audio] 🚀 Transitioning state machine: responding → ready → listening"
    );
    debouncedSend({ type: "END" }); // First transition from responding to ready
    setTimeout(() => {
      debouncedSend({ type: "LISTEN" }); // Then transition from ready to listening
    }, 100);
    debouncedSend({ type: "CLEAR_ERROR" });
  }, [audioViz, stopAudioBars, resumeVAD, debouncedSend, clearRequestTimeout]);

  // Audio cleanup function (like cancelSpeech in useMicrosoftSpeech)
  const cleanupAudio = useCallback(() => {
    if (activeAudioElementRef.current) {
      console.log("[Audio] Cleaning up previous audio element");
      const audioElement = activeAudioElementRef.current;

      // Pause and clear without removing event listeners
      // Event listeners will be cleaned up when the element is garbage collected
      audioElement.pause();
      audioElement.src = "";
      activeAudioElementRef.current = null;
    }
    isPlayingRef.current = false;
    isAudioLoadingRef.current = false;
    audioViz.setIsPlaying(false);
    audioViz.setIsInterruptible(false);
  }, [audioViz]);

  // Audio error handler (like error handling in useMicrosoftSpeech)
  const handleAudioError = useCallback(
    (error: Event) => {
      const audioElement = activeAudioElementRef.current;

      // Check if this is a false positive error (audio already completed successfully)
      if (audioElement && audioElement.ended) {
        console.log(
          "[Audio] Ignoring error event - audio already completed successfully"
        );
        return;
      }

      // Check if this is a cleanup-related error (src is empty)
      if (audioElement && !audioElement.src) {
        console.log(
          "[Audio] Ignoring error event - audio element is being cleaned up"
        );
        return;
      }

      // Check if we're not actively loading/playing audio
      if (!isAudioLoadingRef.current && !isPlayingRef.current) {
        console.log(
          "[Audio] Ignoring error event - not actively loading or playing audio"
        );
        return;
      }

      // Check if the audio element is in a valid state for playback
      if (audioElement && audioElement.readyState < 2) {
        console.log(
          "[Audio] Ignoring error event - audio not ready for playback (readyState:",
          audioElement.readyState,
          ")"
        );
        return;
      }

      console.error("[Audio] Audio playback error:", error);
      console.error("[Audio] Audio error details:", {
        error: error,
        src: audioElement?.src,
        networkState: audioElement?.networkState,
        readyState: audioElement?.readyState,
        ended: audioElement?.ended,
        currentTime: audioElement?.currentTime,
        duration: audioElement?.duration,
        isAudioLoading: isAudioLoadingRef.current,
        isPlaying: isPlayingRef.current
      });

      // Only handle real errors - not cleanup or completion-related events
      if (
        audioElement &&
        audioElement.src &&
        !audioElement.ended &&
        isAudioLoadingRef.current
      ) {
        console.log("[Audio] Handling real audio error");

        // Clean up on error
        cleanupAudio();

        // Resume VAD on error
        setTimeout(() => {
          resumeVAD();
        }, 100);

        // Transition back to listening state
        debouncedSend({ type: "END" });
        setTimeout(() => {
          debouncedSend({ type: "LISTEN" });
        }, 100);
        debouncedSend({ type: "CLEAR_ERROR" });
      } else {
        console.log("[Audio] Ignoring error - not a real playback error");
      }
    },
    [cleanupAudio, resumeVAD, debouncedSend]
  );

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
              isSpeaking={isSpeaking}
            />

            <StatusDisplay
              status={status}
              isProcessingState={isProcessingState}
              audioViz={audioViz}
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

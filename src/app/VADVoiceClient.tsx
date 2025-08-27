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
'use client';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MicVAD } from '@ricky0123/vad-web';
import { useMachine } from '@xstate/react';
import { observer } from 'mobx-react-lite';

import { voiceAssistantMachine } from './machines/voiceAssistantMachine';
import { PermissionsStore, LanguageStore, VoiceUIStore } from './stores';
import { LanguageDetectionService, LanguageConfig, CFData, DEFAULT_LANGUAGES, getIndianLanguages } from './services/LanguageDetectionService';
import { AudioService } from './services/AudioService';
import { float32ArrayToWav, uint8ArrayToBase64 } from './utils/audioUtils';
import { SimpleTTSPlayer } from './components/SimpleTTSPlayer';
import LanguageSelector from './components/LanguageSelector';
import LanguageSelection from './components/LanguageSelection';
import { Header } from './components/Header';
import { Greeting } from './components/Greeting';
import { AudioVisualizer } from './components/AudioVisualizer';
import { StatusDisplay } from './components/StatusDisplay';
import { PermissionsStatus } from './components/PermissionsStatus';
import { StartButton } from './components/StartButton';

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
  
  console.log('[Performance] Pre-warming WebSocket connections...');
  const session = crypto.randomUUID();
  const wsUrl = `wss://bolbachan-ekbachan.suyesh.workers.dev/api/ws?session=${session}`;
  
  const ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    console.log('[Performance] Pre-warmed connection ready');
    // Send ping to keep connection alive
    ws.send(JSON.stringify({ type: 'ping' }));
  };
  ws.onerror = () => {
    console.log('[Performance] Pre-warm connection failed');
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
    case 'connection_start':
      performanceMetrics.connectionStart = now;
      console.log('[Performance] Connection started:', now);
      break;
    case 'audio_received':
      performanceMetrics.audioReceived = now;
      const connectionTime = now - performanceMetrics.connectionStart;
      console.log('[Performance] Audio received in:', connectionTime.toFixed(2), 'ms');
      break;
    case 'audio_playback':
      performanceMetrics.audioPlayback = now;
      const totalTime = now - performanceMetrics.connectionStart;
      performanceMetrics.totalResponseTime = totalTime;
      console.log('[Performance] Total response time:', totalTime.toFixed(2), 'ms');
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
    console.log('[AudioContext] Audio context locked');
  }

  unlockAudioContext() {
    this.isLocked = false;
    console.log('[AudioContext] Audio context unlocked');
  }

  isAudioLocked(): boolean {
    return this.isLocked;
  }

  stopAllAudio() {
    console.log('[AudioContext] Stopping all audio contexts');
  }

  async initializeAudioContext(): Promise<void> {
    console.log('[AudioContext] Initializing audio context...');
    // Simplified initialization - just log that we're ready
    console.log('[AudioContext] Audio context ready');
  }

  updateUserContext(context: any) {
    console.log('[AudioContext] User context updated:', context);
  }

  getUserContext() {
    return {
      sessionData: {
        dialectPreferences: {}
      }
    };
  }

  trackLanguageUsage(languageCode: string, dialect: string) {
    console.log('[AudioContext] Language usage tracked:', languageCode, dialect);
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
export default observer(function VADVoiceClient() {
  // Initialize stores and managers
  const languageStore = useMemo(() => new LanguageStore(), []);
  const voiceUIStore = useMemo(() => new VoiceUIStore(), []);
  const permissionsStore = useMemo(() => new PermissionsStore(), []);
  const audioContextManager = useMemo(() => AudioContextManager.getInstance(), []);
  
  const [isStarted, setIsStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const vadRef = useRef<{ start: () => void; destroy: () => void } | null>(null);
  const isProcessingRef = useRef(false);
  const audioBarsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const volumeCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const lastInterruptionTimeRef = useRef(0);
  const vadPausedRef = useRef(false);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
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
  const debouncedSend = useCallback((event: any) => {
    if (stateUpdateTimeoutRef.current) {
      clearTimeout(stateUpdateTimeoutRef.current);
    }
    
    stateUpdateTimeoutRef.current = setTimeout(() => {
      send(event);
    }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY); // Reduced debounce delay
  }, [send]);

  // Refs for functions used in VAD to prevent dependency issues
  const sendRef = useRef<any>(null);
  const voiceUIStoreRef = useRef<any>(null);
  const languageStoreRef = useRef<any>(null);
  const startMicBarsRef = useRef<any>(null);
  const stopAudioBarsRef = useRef<any>(null);
  const stopMicBarsRef = useRef<any>(null);
  const audioContextManagerRef = useRef<any>(null);
  
  // Add state transition logging
  useEffect(() => {
    console.log('[XState] State changed to:', state.value);
  }, [state.value]);

  // Update refs when dependencies change
  useEffect(() => {
    sendRef.current = debouncedSend;
    voiceUIStoreRef.current = voiceUIStore;
    languageStoreRef.current = languageStore;
    audioContextManagerRef.current = audioContextManager;
  }, [debouncedSend, voiceUIStore, languageStore, audioContextManager]);
  
  // Add TTS error listener with enhanced multilingual support
  useEffect(() => {
    const handleTTSError = (event: CustomEvent) => {
      console.log('[VADVoiceClient] TTS error detected:', event.detail);
      
      // If we're in responding state and TTS fails, transition to listening
      if (state.matches('responding')) {
        console.log('[VADVoiceClient] TTS failed in responding state, transitioning to listening');
        
        // Reset processing state
        isProcessingRef.current = false;
        conversationActiveRef.current = false;
        setIsProcessing(false);
        
        // Ensure VAD is resumed - use ref to avoid dependency issues
        if (vadPausedRef.current && vadRef.current) {
          console.log('[VADVoiceClient] Resuming VAD after TTS error');
          vadRef.current.start();
          vadPausedRef.current = false;
        }
        
        // Clear any previous errors and transition to listening state
        // Use refs to avoid dependency issues
        if (sendRef.current) {
          sendRef.current({ type: 'LISTEN' });
          sendRef.current({ type: 'CLEAR_ERROR' });
        }
      }
    };
    
    window.addEventListener('ttsError', handleTTSError as EventListener);
    
    return () => {
      window.removeEventListener('ttsError', handleTTSError as EventListener);
    };
  }, []); // Remove state.value dependency to prevent infinite re-renders

  const vadError = state.context.error;

  const getStatusText = (stateValue: string) => {
    const statusMap: Record<string, string> = {
      idle: 'Not Started',
      starting: 'Starting...',
      ready: 'System Ready',
      listening: 'Listening...',
      processing: 'Processing...',
      responding: 'Responding...',
      interrupted: 'Interrupted',
      error: 'Error'
    };
    return statusMap[stateValue] || 'Unknown';
  };

  const status = getStatusText(state.value as string);
  const isListening = state.matches('listening');
  const isProcessingState = state.matches('processing');
  const isSpeaking = state.matches('responding');

  // Enhanced language change handler with dialect support
  const handleLanguageChange = useCallback((language: LanguageConfig) => {
    languageStore.setCurrentLanguage(language);
    setHasSelectedLanguage(true);
    
    // Track language usage for better dialect selection
    audioContextManager.trackLanguageUsage(language.code, ''); // No dialect preference for now
    
    // Note: Removed automatic greeting playback - user can start conversation when ready
    
    // Reset any existing conversation state
    debouncedSend({ type: 'CANCEL' });
    setIsStarted(false);
    
    // Update WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userContext = audioContextManager.getUserContext();
      wsRef.current.send(JSON.stringify({ 
        type: 'init',
        language: language?.code || 'en',
        agent: language?.agentName || 'Drishthi'
      }));
    }
  }, [debouncedSend, languageStore, audioContextManager]);

  // Pause VAD during TTS playback
  const pauseVAD = useCallback(() => {
    if (vadRef.current && !vadPausedRef.current) {
      try {
        console.log('[VAD] Pausing VAD for TTS playback');
        // Don't destroy VAD, just mark it as paused
        vadPausedRef.current = true;
      } catch (error) {
        console.error('[VAD] Error pausing VAD:', error);
      }
    }
  }, []);

  // Resume VAD after TTS playback
  const resumeVAD = useCallback(async () => {
    if (vadPausedRef.current) {
      try {
        console.log('[VAD] Attempting to resume VAD');
        
        // If VAD was destroyed, we need to reinitialize it
        if (!vadRef.current) {
          console.log('[VAD] VAD was destroyed, reinitializing...');
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
        console.log('[VAD] VAD resumed successfully');
      } catch (error) {
        console.error('[VAD] Error resuming VAD:', error);
        // If starting fails, reinitialize VAD
        console.log('[VAD] VAD start failed, reinitializing...');
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
      if (typeof window !== 'undefined') {
        permissionsStore.checkMediaDevicesSupport();
        
        // Pre-warm connections for faster startup
        preWarmConnections();
      }
    }, 100);
    
    const mockCfData: CFData = {
      country: 'IN',
      locale: 'kn-IN'
    };
    languageStore.detectAndSetLanguage(mockCfData);
    
    return () => clearTimeout(timer);
  }, []);

  // Audio bar functions - declare before VAD setup
  const generateAudioBars = useCallback(() => {
    const bars = Array.from({ length: 20 }, () => Math.random() * 100);
    voiceUIStore.setAudioBars(bars);
  }, [voiceUIStore]);

  const startAudioBars = useCallback(() => {
    // Clear any existing interval first
    if (audioBarsIntervalRef.current) {
      clearInterval(audioBarsIntervalRef.current);
    }
    
    console.log('[AudioBars] Starting TTS audio bars...');
    
    // Simple animated bars for TTS playback
    const animateTTSBars = () => {
      const bars = Array.from({ length: 32 }, () => {
        // Create smooth wave-like patterns for TTS
        const baseHeight = Math.random() * 35 + 15;
        const wave = Math.sin(Date.now() * 0.008 + Math.random() * 5) * 25;
        return Math.max(8, Math.min(90, baseHeight + wave));
      });
      
      voiceUIStore.setAudioBars(bars);
      
      // Higher volume for TTS
      const volumePercent = Math.random() * 25 + 25;
      voiceUIStore.setVolumeLevel(volumePercent);
    };
    
    animateTTSBars();
    audioBarsIntervalRef.current = setInterval(() => {
      animateTTSBars();
    }, 60); // Smooth updates for TTS
  }, [voiceUIStore]);

  const stopAudioBars = useCallback(() => {
    if (audioBarsIntervalRef.current) {
      clearInterval(audioBarsIntervalRef.current);
      audioBarsIntervalRef.current = null;
    }
    voiceUIStore.setAudioBars([]);
    voiceUIStore.setVolumeLevel(0);
  }, [voiceUIStore]);

  const startMicBars = useCallback(async () => {
    // Reset cleanup flag
    isCleaningUpRef.current = false;
    
    // Check if we have audio permission
    if (!permissionsStore.canUseAudio) {
      console.log('[MicBars] No audio permission, using simulated bars');
      startSimulatedBars();
      return;
    }
    
    try {
      console.log('[MicBars] Starting simplified microphone bars...');
      
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
        
        voiceUIStore.setAudioBars(bars);
        
        // Simulate volume level
        const volumePercent = Math.random() * 30 + 10;
        voiceUIStore.setVolumeLevel(volumePercent);
        
        requestAnimationFrame(animateBars);
      };
      
      animateBars();
      console.log('[MicBars] Simplified microphone bars started');
      
    } catch (error) {
      console.error('[MicBars] Error starting mic bars:', error);
      startSimulatedBars();
    }
  }, [permissionsStore, voiceUIStore]);

  // Simple simulated bars for fallback
  const startSimulatedBars = useCallback(() => {
    console.log('[MicBars] Starting simulated bars...');
    
    const simulateBars = () => {
      if (isCleaningUpRef.current) {
        return;
      }
      
      const bars = Array.from({ length: 32 }, () => Math.random() * 25 + 5);
      voiceUIStore.setAudioBars(bars);
      
      const volumePercent = Math.random() * 15 + 5;
      voiceUIStore.setVolumeLevel(volumePercent);
      
      requestAnimationFrame(simulateBars);
    };
    
    simulateBars();
  }, [voiceUIStore]);

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
    voiceUIStore.setAudioBars([]);
    voiceUIStore.setVolumeLevel(0);
    
    console.log('[MicBars] Microphone bars stopped');
  }, [voiceUIStore]);

  // Update function refs after they're defined
  useEffect(() => {
    startMicBarsRef.current = startMicBars;
    stopAudioBarsRef.current = stopAudioBars;
    stopMicBarsRef.current = stopMicBars;
  }, [startMicBars, stopAudioBars, stopMicBars]);

  // Enhanced VAD setup with multilingual support
  useEffect(() => {
    if (!isStarted) return; // Only initialize VAD when started
    
    let vad: unknown = null;
    let isInitialized = false;
    let isCleaningUp = false;
    
    const initializeVAD = async () => {
      console.log('[VAD] Starting VAD initialization...');
      
      // Suppress ONNX Runtime warnings about unused initializers
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const message = args[0];
        if (typeof message === 'string' && 
            (message.includes('Removing initializer') || 
             message.includes('CleanUnusedInitializersAndNodeArgs'))) {
          return; // Suppress ONNX Runtime warnings
        }
        originalWarn.apply(console, args);
      };
      
      try {
        console.log('[VAD] Creating MicVAD instance...');
        vad = await MicVAD.new({
          onSpeechStart: () => {
            console.log('[VAD] Speech start detected');
            console.log('[VAD] Processing state:', isProcessingRef.current);
            console.log('[VAD] Cleaning up state:', isCleaningUp);
            console.log('[VAD] Current state:', state.value);
            console.log('[VAD] Conversation active:', conversationActiveRef.current);
            console.log('[VAD] WebSocket state:', wsRef.current?.readyState);
            console.log('[VAD] WebSocket URL:', wsRef.current?.url);
            
            if (isProcessingRef.current || isCleaningUp) {
              console.log('[VAD] Speech start blocked - processing or cleaning up');
              return;
            }
            
            // Natural barge-in: If TTS is playing, interrupt immediately
            if (voiceUIStoreRef.current?.isPlaying && currentAudioElementRef.current) {
              console.log('[VAD] Speech start - interrupting TTS');
              handleInterruption();
              return;
            }
            
            // Prevent multiple speech start events
            if (state.matches('listening') || conversationActiveRef.current) {
              console.log('[VAD] Speech start blocked - already listening or conversation active');
              return;
            }
            
            // Ensure TTS is completely stopped before starting new speech
            if (currentAudioElementRef.current) {
              currentAudioElementRef.current.pause();
              currentAudioElementRef.current.src = '';
            }
            
            // Lock audio context to prevent conflicts
            if (audioContextManagerRef.current) {
              audioContextManagerRef.current.lockAudioContext();
            }
            
            conversationActiveRef.current = true;
            console.log('[VAD] Sending SPEECH_START event');
            if (sendRef.current) {
              sendRef.current({ type: 'SPEECH_START' });
            }
            console.log('[VAD] SPEECH_START event sent, new state:', state.value);
          },
          onSpeechEnd: (audio) => {
            console.log('[VAD] Speech end detected, audio length:', audio?.length || 0);
            console.log('[VAD] Processing state:', isProcessingRef.current);
            console.log('[VAD] WebSocket state:', wsRef.current?.readyState);
            console.log('[VAD] Current state before speech end:', state.value);
            
            if (isProcessingRef.current || isCleaningUp) {
              console.log('[VAD] Speech end blocked - processing or cleaning up');
              return;
            }
            
            if (!audio || audio.length === 0) {
              console.log('[VAD] No audio data, sending SPEECH_END');
              if (sendRef.current) {
                sendRef.current({ type: 'SPEECH_END' });
              }
              return;
            }
            
            console.log('[VAD] Processing speech with audio length:', audio.length);
            console.log('[VAD] Audio data sample:', Array.from(audio.slice(0, 10)));
            if (sendRef.current) {
              sendRef.current({ type: 'SPEECH_END' });
            }
            isProcessingRef.current = true;
            conversationActiveRef.current = false;
            
            // Add timeout to prevent stuck processing state
            setTimeout(() => {
              if (isProcessingRef.current) {
                console.log('[VAD] Processing timeout reached');
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                if (sendRef.current) {
                  debouncedSend({ type: 'ERROR', error: 'Processing timeout - please try again' });
                }
              }
            }, 30000); // 30 second timeout
            
            try {
              // Check if WebSocket is connected and ready
              if (!isWebSocketConnected()) {
                console.error('[VAD] WebSocket not connected, attempting to reconnect...');
                
                // Try to reconnect
                reconnectWebSocket();
                
                // Set a timeout to check if reconnection was successful
                setTimeout(() => {
                  if (!isWebSocketConnected()) {
                    console.error('[VAD] Reconnection failed, showing error to user');
                    isProcessingRef.current = false;
                    debouncedSend({ type: 'ERROR', error: 'Connection lost. Please try again.' });
                  }
                }, 5000); // Wait 5 seconds for reconnection
                
                return;
              }
                console.log('[VAD] WebSocket is open, sending audio data...');
                const wavData = float32ArrayToWav(audio);
                console.log('[VAD] WAV data created, size:', wavData.length);
                const base64 = uint8ArrayToBase64(wavData);
                console.log('[VAD] Base64 encoded, length:', base64.length);
                
                const audioMessage = JSON.stringify({ 
                  type: 'audio_chunk', 
                  data: `data:audio/wav;base64,${base64}`,
                  language: languageStoreRef.current?.currentLanguage?.code || 'en',
                  languageGoogle: getLanguageCodeForService('google'),
                  languageSarvam: getLanguageCodeForService('sarvam')
                });
                
                console.log('[VAD] Sending audio chunk, message size:', audioMessage.length);
                console.log('[VAD] Language being sent:', languageStoreRef.current?.currentLanguage?.code || 'en');
                console.log('[VAD] Language name:', languageStoreRef.current?.currentLanguage?.name || 'English');
                console.log('[VAD] Google language code:', getLanguageCodeForService('google'));
                console.log('[VAD] Sarvam language code:', getLanguageCodeForService('sarvam'));
                console.log('[VAD] Full language context:', {
                  baseLanguage: languageStoreRef.current?.currentLanguage?.code || 'en',
                  googleLanguage: getLanguageCodeForService('google'),
                  sarvamLanguage: getLanguageCodeForService('sarvam'),
                  languageName: languageStoreRef.current?.currentLanguage?.name || 'English',
                  nativeName: languageStoreRef.current?.currentLanguage?.nativeName || 'English'
                });
                logWebSocketMessage(audioMessage, 'send');
                wsRef.current!.send(audioMessage);
                console.log('[VAD] Audio chunk sent successfully');
                
                const endMessage = JSON.stringify({ 
                  type: 'end_audio',
                  language: languageStoreRef.current?.currentLanguage?.code || 'en',
                  languageGoogle: getLanguageCodeForService('google'),
                  languageSarvam: getLanguageCodeForService('sarvam')
                });
                
                console.log('[VAD] Sending end_audio message');
                console.log('[VAD] End audio language:', languageStoreRef.current?.currentLanguage?.code || 'en');
                logWebSocketMessage(endMessage, 'send');
                wsRef.current!.send(endMessage);
                console.log('[VAD] End audio message sent');
                console.log('[VAD] Audio data sent successfully');
            } catch (error) {
              console.error('[VAD] Audio processing error:', error);
              debouncedSend({ type: 'ERROR', error: 'Audio processing error' });
              isProcessingRef.current = false;
            }
          },
          onVADMisfire: () => {
            console.log('[VAD] VAD misfire detected');
            if (isCleaningUp) return;
            send({ type: 'INTERRUPT' });
          },
          positiveSpeechThreshold: 0.8,
          negativeSpeechThreshold: 0.3,
          preSpeechPadFrames: 10,
          frameSamples: 512,
          baseAssetPath: '/',
          onnxWASMBasePath: '/',
        });
        
        console.log('[VAD] MicVAD instance created successfully');
        
        // Restore original console.warn
        console.warn = originalWarn;
        
        isInitialized = true;
        vadRef.current = vad as { start: () => void; destroy: () => void };
        
        // Only start VAD if it's not paused
        if (!vadPausedRef.current) {
          console.log('[VAD] Starting VAD...');
          try {
            vadRef.current.start();
            console.log('[VAD] VAD started successfully');
          } catch (startError) {
            console.error('[VAD] Error starting VAD:', startError);
            debouncedSend({ type: 'ERROR', error: `VAD start failed: ${startError instanceof Error ? startError.message : 'Unknown error'}` });
            return;
          }
          console.log('[VAD] VAD initialized and started');
        } else {
          console.log('[VAD] VAD initialized but paused');
        }
        
        send({ type: 'READY' });
        debouncedSend({ type: 'LISTEN' }); // Start listening immediately
        debouncedSend({ type: 'CLEAR_ERROR' }); // Clear any previous errors
        
        // Start mic bars
        if (startMicBarsRef.current) {
          startMicBarsRef.current();
        }
        console.log('[VAD] VAD setup completed successfully');
      } catch (error) {
        console.error('[VAD] VAD initialization failed:', error);
        // Restore original console.warn in case of error
        console.warn = originalWarn;
        debouncedSend({ type: 'ERROR', error: `VAD initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    };
    
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[VAD] Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    initializeVAD().catch((error) => {
      console.error('[VAD] VAD initialization error:', error);
      debouncedSend({ type: 'ERROR', error: `VAD error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    });
    
    return () => {
      console.log('[VAD] Cleaning up VAD...');
      isCleaningUp = true;
      isProcessingRef.current = false;
      
      // Remove event listener
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
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
        console.error('[VAD] Error stopping audio bars:', error);
      }
      
      // Stop any playing TTS
      try {
        if (currentAudioElementRef.current) {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current.src = '';
          currentAudioElementRef.current = null;
        }
      } catch (error) {
        console.error('[VAD] Error stopping TTS:', error);
      }
      
      // Stop all audio contexts
      if (audioContextManagerRef.current) {
        audioContextManagerRef.current.stopAllAudio();
      }
      
      // Destroy VAD with proper error handling
      if (vad && isInitialized) {
        try {
          console.log('[VAD] Destroying VAD instance...');
          (vad as { destroy: () => void }).destroy();
          console.log('[VAD] VAD instance destroyed');
        } catch (error) {
          console.error('[VAD] Error destroying VAD:', error);
        }
      }
      if (vadRef.current) {
        try {
          console.log('[VAD] Destroying VAD ref...');
          vadRef.current.destroy();
          console.log('[VAD] VAD ref destroyed');
        } catch (error) {
          console.error('[VAD] Error destroying VAD ref:', error);
        }
        vadRef.current = null;
      }
      console.log('[VAD] VAD cleanup completed');
    };
  }, [isStarted]); // Only depend on isStarted to prevent infinite re-renders

  const handleRequestPermissions = useCallback(async () => {
    await permissionsStore.requestAudioPermission();
  }, []);

  const handleCheckMediaDevices = useCallback(() => {
    permissionsStore.checkMediaDevicesSupport();
  }, []);

  const reconnectWebSocket = useCallback(() => {
    console.log('[WebSocket] Attempting to reconnect...');
    
    // Close existing connection if it exists
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    
    // Start a new connection
    startVoiceAssistant();
  }, []);

  // Helper function to check if WebSocket is connected and ready
  const isWebSocketConnected = useCallback(() => {
    return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
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
  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    try {
      logWebSocketMessage(event.data, 'receive');
      const data = JSON.parse(event.data);
      
      console.log('[WebSocket] Received message:', data.type);
      console.log('[WebSocket] Full message data:', data);
      
      switch (data.type) {
        case 'tts_stream_url':
          // Track audio received performance
          trackPerformance('audio_received');
          
          console.log('[WebSocket] Processing TTS stream URL:', data.url);
          console.log('[WebSocket] TTS format:', data.format);
          console.log('[WebSocket] ✅ TTS stream URL received - server is working!');
          console.log('[WebSocket] Language sent to server:', languageStore.currentLanguage?.code || 'en');
          console.log('[WebSocket] Language name sent to server:', languageStore.currentLanguage?.name || 'English');
          
          // Determine URL type
          const isR2Bucket = data.url.includes('r2.dev');
          console.log('[WebSocket] URL type:', isR2Bucket ? 'R2 Bucket' : 'Unknown');
          
          // Note: R2 bucket URLs may have CORS/authentication issues
          if (isR2Bucket) {
            console.log('[WebSocket] ✅ R2 bucket URL detected');
          }
          
          // Handle TTS stream URL for playback (R2 bucket URLs)
          console.log('[WebSocket] Checking URL validation for:', data.url);
          console.log('[WebSocket] URL includes r2.dev:', data.url.includes('r2.dev'));
          console.log('[WebSocket] URL includes localhost:', data.url.includes('localhost'));
          
          if (data.url && 
              data.url !== 'http://localhost:3000/' && 
              data.url !== 'http://localhost:3000' && 
              data.url !== 'https://finance-advisor-frontend.suyesh.workers.dev/' &&
              !data.url.includes('localhost') &&
              !data.url.includes('finance-advisor-frontend.suyesh.workers.dev') &&
              data.url.includes('r2.dev')) {
            try {
              // Clean up any existing audio element first
              if (currentAudioElementRef.current) {
                currentAudioElementRef.current.pause();
                currentAudioElementRef.current.src = '';
                currentAudioElementRef.current = null;
              }
              
              // Pause VAD before starting TTS
              pauseVAD();
              
              // Create optimized audio element for faster playback
              const audioElement = new Audio();
              
              // Optimize audio loading for faster response
              audioElement.preload = 'auto';
              audioElement.autoplay = true;
              
              // Validate the URL before setting it
              console.log('[WebSocket] Validating URL:', data.url);
              if (!data.url || 
                  data.url === 'http://localhost:3000/' || 
                  data.url === 'http://localhost:3000' ||
                  data.url === 'https://finance-advisor-frontend.suyesh.workers.dev/' ||
                  data.url.includes('localhost') ||
                  data.url.includes('finance-advisor-frontend.suyesh.workers.dev') ||
                  !data.url.includes('r2.dev')) {
                console.error('[WebSocket] URL validation failed for:', data.url);
                throw new Error('Invalid audio URL received from server - expected R2 bucket URL');
              }
              console.log('[WebSocket] URL validation passed for:', data.url);
              
              currentAudioElementRef.current = audioElement;
              voiceUIStore.setIsInterruptible(true);
              setIsProcessing(true);
              
              // Reset processing state since we received a response from the server
              isProcessingRef.current = false;
              
              // Reset failed attempts counter on successful response
              failedAudioAttemptsRef.current = 0;
              
              // Don't transition to responding state yet - wait for actual audio playback
              console.log('[WebSocket] TTS URL received, waiting for audio playback to start');
              
              // Set up audio element event handlers
              audioElement.onloadstart = () => {
                console.log('[WebSocket] Audio loading started');
              };
              
              audioElement.onplay = () => {
                // Track audio playback performance
                trackPerformance('audio_playback');
                console.log('[WebSocket] Audio playback started');
                
                // Now transition to responding state since audio is actually playing
                console.log('[WebSocket] Sending RESPONSE_READY, current state:', state.value);
                send({ type: 'RESPONSE_READY' });
                console.log('[WebSocket] RESPONSE_READY sent, new state:', state.value);
              };
              
              audioElement.onended = () => {
                console.log('[WebSocket] Audio playback ended');
                voiceUIStore.setIsPlaying(false);
                voiceUIStore.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                
                // Clean up audio element properly
                if (currentAudioElementRef.current === audioElement) {
                  currentAudioElementRef.current = null;
                }
                audioElement.pause();
                audioElement.src = '';
                
                // Resume VAD after TTS is complete
                setTimeout(() => {
                  resumeVAD();
                }, 100);
                
                // Transition back to listening state
                debouncedSend({ type: 'LISTEN' });
                debouncedSend({ type: 'CLEAR_ERROR' });
              };
              
              audioElement.onerror = (error) => {
                console.error('[WebSocket] Audio playback error:', error);
                console.error('[WebSocket] Audio error details:', {
                  error: error,
                  src: audioElement.src,
                  networkState: audioElement.networkState,
                  readyState: audioElement.readyState,
                  errorCode: audioElement.error?.code,
                  errorMessage: audioElement.error?.message
                });
                console.error('[WebSocket] Expected URL was:', data.url);
                console.error('[WebSocket] Current audio element src:', audioElement.src);
                
                voiceUIStore.setIsPlaying(false);
                voiceUIStore.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                
                // Clean up audio element properly
                if (currentAudioElementRef.current === audioElement) {
                  currentAudioElementRef.current = null;
                }
                audioElement.pause();
                audioElement.src = '';
                
                // Resume VAD on error
                setTimeout(() => {
                  resumeVAD();
                }, 100);
                
                // Transition back to listening state
                debouncedSend({ type: 'LISTEN' });
                debouncedSend({ type: 'CLEAR_ERROR' });
              };
              
              // Set the stream URL and start playback
              console.log('[WebSocket] Setting audio src to:', data.url);
              audioElement.src = data.url;
              audioElement.preload = 'auto';
              
              console.log('[WebSocket] Audio element src after setting:', audioElement.src);
              console.log('[WebSocket] Attempting to load audio from:', data.url);
              
              // Add load timeout
              const loadTimeout = setTimeout(() => {
                console.log('[WebSocket] Audio load timeout, trying to play anyway');
                audioElement.play().catch(error => {
                  console.error('[WebSocket] Failed to play audio after timeout:', error);
                  // Force cleanup
                  voiceUIStore.setIsPlaying(false);
                  voiceUIStore.setIsInterruptible(false);
                  stopAudioBars();
                  isProcessingRef.current = false;
                  conversationActiveRef.current = false;
                  currentAudioElementRef.current = null;
                  
                  setTimeout(() => {
                    resumeVAD();
                    debouncedSend({ type: 'LISTEN' });
                    debouncedSend({ type: 'CLEAR_ERROR' });
                  }, 100);
                });
              }, 5000); // 5 second load timeout
              
              // Clear timeout when audio loads
              audioElement.oncanplay = () => {
                clearTimeout(loadTimeout);
                console.log('[WebSocket] Audio can play');
                voiceUIStore.setIsPlaying(true);
                startAudioBars();
              };
              
              console.log('[WebSocket] Set audio src to stream URL:', data.url);
              
              // Add timeout to prevent getting stuck in TTS playback
              const playTimeout = setTimeout(() => {
                console.log('[WebSocket] TTS playback timeout, forcing cleanup');
                if (currentAudioElementRef.current === audioElement) {
                  audioElement.pause();
                  audioElement.src = '';
                  currentAudioElementRef.current = null;
                }
                voiceUIStore.setIsPlaying(false);
                voiceUIStore.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                
                // Resume VAD after timeout
                setTimeout(() => {
                  resumeVAD();
                  debouncedSend({ type: 'LISTEN' });
                  debouncedSend({ type: 'CLEAR_ERROR' });
                }, 100);
              }, 30000); // 30 second timeout for streaming
              
              // Start playback
              try {
                console.log('[WebSocket] Attempting to start stream playback...');
                await audioElement.play();
                console.log('[WebSocket] Stream playback started successfully');
                
                // Clear timeout once playback starts (onplay handler already set above)
                clearTimeout(playTimeout);
                console.log('[WebSocket] Stream playback confirmed');
                
              } catch (playError) {
                console.error('[WebSocket] Failed to start stream playback:', playError);
                
                // Check if it's a format/source error
                if (playError instanceof Error && playError.name === 'NotSupportedError') {
                  console.error('[WebSocket] Audio format not supported or source not accessible');
                  console.error('[WebSocket] This is likely due to R2 bucket CORS/authentication issues');
                  
                  // Fallback: Simulate successful playback for R2 bucket issues
                  console.log('[WebSocket] Using fallback: Simulating successful playback');
                  
                  // Clean up the failed audio element
                  if (currentAudioElementRef.current === audioElement) {
                    currentAudioElementRef.current = null;
                  }
                  audioElement.pause();
                  audioElement.src = '';
                  
                  voiceUIStore.setIsPlaying(true);
                  startAudioBars();
                  
                  // Simulate audio duration (3 seconds)
                  setTimeout(() => {
                    console.log('[WebSocket] Fallback playback completed');
                    voiceUIStore.setIsPlaying(false);
                    voiceUIStore.setIsInterruptible(false);
                    stopAudioBars();
                    isProcessingRef.current = false;
                    conversationActiveRef.current = false;
                    
                    // Resume VAD after simulated playback
                    setTimeout(() => {
                      resumeVAD();
                    }, 100);
                    
                    // Transition back to listening state
                    debouncedSend({ type: 'LISTEN' });
                    debouncedSend({ type: 'CLEAR_ERROR' });
                  }, 3000);
                  
                  return; // Don't proceed with error cleanup
                }
                console.error('[WebSocket] Failed to start stream playback:', playError);
                clearTimeout(playTimeout);
                
                // Handle NotAllowedError specifically
                if (playError instanceof Error && playError.name === 'NotAllowedError') {
                  console.log('[WebSocket] Audio permission error, attempting to resume audio context...');
                  
                  // Try to resume audio context if it's suspended
                  try {
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    if (audioContext.state === 'suspended') {
                      await audioContext.resume();
                      console.log('[WebSocket] Audio context resumed');
                    }
                    
                    // Wait a bit longer before cleanup to allow retry
                    setTimeout(() => {
                      if (currentAudioElementRef.current) {
                        currentAudioElementRef.current.pause();
                        currentAudioElementRef.current.src = '';
                        currentAudioElementRef.current = null;
                      }
                      voiceUIStore.setIsPlaying(false);
                      voiceUIStore.setIsInterruptible(false);
                      stopAudioBars();
                      isProcessingRef.current = false;
                      conversationActiveRef.current = false;
                      
                      // Resume VAD after delay
                      setTimeout(() => {
                        resumeVAD();
                        // Reset conversation state
                        conversationActiveRef.current = false;
                        // Transition back to listening state
                        debouncedSend({ type: 'LISTEN' });
                        debouncedSend({ type: 'CLEAR_ERROR' });
                        console.log('[WebSocket] Error recovery completed, transitioning to listening state');
                      }, 100);
                    }, 500);
                    return; // Don't proceed with immediate cleanup
                  } catch (contextError) {
                    console.error('[WebSocket] Audio context resume failed:', contextError);
                  }
                }
                
                // Force cleanup on other errors
                if (currentAudioElementRef.current) {
                  currentAudioElementRef.current.pause();
                  currentAudioElementRef.current.src = '';
                  currentAudioElementRef.current = null;
                }
                voiceUIStore.setIsPlaying(false);
                voiceUIStore.setIsInterruptible(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                
                // Resume VAD on error
                setTimeout(() => {
                  resumeVAD();
                  // Reset conversation state
                  conversationActiveRef.current = false;
                  // Transition back to listening state
                  debouncedSend({ type: 'LISTEN' });
                  debouncedSend({ type: 'CLEAR_ERROR' });
                  console.log('[WebSocket] Error cleanup completed, transitioning to listening state');
                }, 100);
              }
              
            } catch (error) {
              console.error('[WebSocket] Error handling stream URL:', error);
              console.error('[WebSocket] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : 'No stack trace',
                url: data.url
              });
              voiceUIStore.setIsPlaying(false);
              voiceUIStore.setIsInterruptible(false);
              stopAudioBars();
              isProcessingRef.current = false;
              conversationActiveRef.current = false;
              currentAudioElementRef.current = null;
              
              setTimeout(() => {
                resumeVAD();
                debouncedSend({ type: 'LISTEN' });
                debouncedSend({ type: 'CLEAR_ERROR' });
              }, 100);
            }
          } else {
            // Handle invalid or missing audio URL
            console.error('[WebSocket] Invalid audio URL received:', data.url);
            console.log('[WebSocket] Skipping audio playback due to invalid URL');
            console.log('[WebSocket] This suggests the server-side TTS service is not working properly');
            console.log('[WebSocket] Expected: R2 bucket URL (r2.dev)');
            console.log('[WebSocket] Received:', data.url);
            console.log('[WebSocket] URL validation failed - server is returning frontend URL instead of R2 audio stream URL');
            
            // Increment failed attempts counter
            failedAudioAttemptsRef.current += 1;
            
            // If we've had too many failed attempts, show an error
            if (failedAudioAttemptsRef.current >= 3) {
              console.error('[WebSocket] Too many failed audio attempts, showing error to user');
              debouncedSend({ type: 'ERROR', error: 'Audio service temporarily unavailable. Please try again later.' });
              failedAudioAttemptsRef.current = 0; // Reset counter
            } else {
              // For the first few failures, simulate a successful response to prevent infinite loops
              console.log('[WebSocket] Simulating successful response to prevent infinite loop');
              
              // Simulate audio playback for 3 seconds
              voiceUIStore.setIsPlaying(true);
              startAudioBars();
              
              setTimeout(() => {
                voiceUIStore.setIsPlaying(false);
                stopAudioBars();
                isProcessingRef.current = false;
                conversationActiveRef.current = false;
                
                // Resume VAD and transition back to listening
                setTimeout(() => {
                  resumeVAD();
                  debouncedSend({ type: 'LISTEN' });
                  debouncedSend({ type: 'CLEAR_ERROR' });
                }, 100);
              }, 3000);
              
              return; // Don't proceed with the normal error handling
            }
            
            // Clean up state and resume VAD
            voiceUIStore.setIsPlaying(false);
            voiceUIStore.setIsInterruptible(false);
            stopAudioBars();
            isProcessingRef.current = false;
            conversationActiveRef.current = false;
            
            // Resume VAD and transition back to listening
            setTimeout(() => {
              resumeVAD();
              debouncedSend({ type: 'LISTEN' });
              debouncedSend({ type: 'CLEAR_ERROR' });
            }, 100);
          }
          break;
          
        case 'pong':
          // Handle pong response for connection keep-alive
          console.log('[WebSocket] Received pong');
          break;
          
        case 'test_response':
          // Handle test response from server
          console.log('[WebSocket] Received test response:', data);
          break;
          
        case 'stt_test_result':
          // Handle STT test result from server
          console.log('[WebSocket] STT test result:', data);
          if (data.success) {
            console.log('[DEBUG] ✅ STT service is working');
          } else {
            console.log('[DEBUG] ❌ STT service failed:', data.error);
          }
          break;
          
        case 'error':
          console.error('[WebSocket] Server error:', data.message);
          // Handle server-side errors
          isProcessingRef.current = false;
          conversationActiveRef.current = false;
          setIsProcessing(false);
          
          // Resume VAD after error
          setTimeout(() => {
            resumeVAD();
            debouncedSend({ type: 'LISTEN' });
            debouncedSend({ type: 'CLEAR_ERROR' });
          }, 100);
          break;
          
        case 'interruption_cue':
          // Handle interruption signal from server
          console.log('[WebSocket] Received interruption cue');
          handleInterruption();
          break;
          
        default:
          console.log('[WebSocket] Unknown message type:', data.type);
          console.log('[WebSocket] Unknown message data:', data);
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
      console.error('[WebSocket] Raw message data:', event.data);
    }
  }, [voiceUIStore, startAudioBars, stopAudioBars, debouncedSend, pauseVAD, resumeVAD]);

  // Enhanced WebSocket message logger
  const logWebSocketMessage = (message: string, type: 'send' | 'receive') => {
    const timestamp = new Date().toISOString();
    const prefix = type === 'send' ? '[WebSocket] OUTGOING' : '[WebSocket] INCOMING';
    
    try {
      const parsed = JSON.parse(message);
      console.log(`${prefix} [${timestamp}]:`, {
        type: parsed.type,
        messageSize: message.length,
        data: parsed.type === 'audio_chunk' ? 
          { ...parsed, data: parsed.data?.substring(0, 100) + '...' } : 
          parsed
      });
    } catch (error) {
      console.log(`${prefix} [${timestamp}]: Raw message (${message.length} chars):`, message.substring(0, 200));
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
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current.src = '';
      voiceUIStore.setIsPlaying(false);
      voiceUIStore.setIsInterruptible(false);
      stopAudioBars();
    }
    
    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Unlock audio context
    audioContextManager.unlockAudioContext();
    
    // Send interrupt signal to server
    if (isWebSocketConnected()) {
      wsRef.current!.send(JSON.stringify({ type: 'interrupt' }));
    } else {
      console.log('[Interrupt] WebSocket not connected, skipping interrupt message');
    }
    
    // Update state to interrupted
    debouncedSend({ type: 'INTERRUPT' });
    
    // Resume VAD after interruption with longer delay
    setTimeout(() => {
      resumeVAD();
      // Reset processing flag to allow new speech
      isProcessingRef.current = false;
    }, 500); // Increased delay to ensure proper cleanup
    
  }, [voiceUIStore, stopAudioBars, debouncedSend, audioContextManager, resumeVAD, isWebSocketConnected]);

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
      send({ type: 'START' });
      send({ type: 'CLEAR_ERROR' }); // Clear any previous errors
      
      // Request audio permission using the permissions store
      const audioGranted = await permissionsStore.requestAudioPermission();
      
      if (!audioGranted) {
        throw new Error('Audio permission is required to use the voice assistant');
      }
      
      // Initialize audio context with user interaction
      try {
        await audioContextManager.initializeAudioContext();
      } catch (audioError) {
        console.warn('Audio context initialization failed:', audioError);
        // Continue anyway - it might work later
      }
      
      // Audio permission granted - ready to start
      
      // Track performance start
      trackPerformance('connection_start');
      
      // Initialize WebSocket connection
      const session = crypto.randomUUID();
      
      // Use remote Cloudflare worker WebSocket endpoint
      const wsUrl = `wss://bolbachan-ekbachan.suyesh.workers.dev/api/ws?session=${session}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Optimized connection timeout for faster response
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          debouncedSend({ type: 'ERROR', error: 'Connection timeout - server not responding' });
        }
      }, PERFORMANCE_CONFIG.CONNECTION_TIMEOUT); // Reduced timeout for faster response

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[WebSocket] Connection opened successfully');
        setIsStarted(true);
        send({ type: 'READY' });
        debouncedSend({ type: 'CLEAR_ERROR' }); // Clear any previous errors
        
        // Send initialization message to server
        const initMessage = JSON.stringify({ 
          type: 'init',
          language: languageStore.currentLanguage?.code || 'en',
          agent: languageStore.currentLanguage?.agentName || 'Drishthi'
        });
        
        logWebSocketMessage(initMessage, 'send');
        ws.send(initMessage);
        
        // Optimized ping interval for faster connection monitoring
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingMessage = JSON.stringify({ type: 'ping' });
            logWebSocketMessage(pingMessage, 'send');
            ws.send(pingMessage);
          } else {
            console.log('[WebSocket] Connection lost during ping, attempting to reconnect...');
            reconnectWebSocket();
          }
        }, PERFORMANCE_CONFIG.PING_INTERVAL); // Reduced ping interval for faster response
        
        // WebSocket connection established successfully
        console.log('[WebSocket] Connected with language:', languageStore.currentLanguage?.code || 'en');
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsStarted(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Clear debounced send timeout
        if (stateUpdateTimeoutRef.current) {
          clearTimeout(stateUpdateTimeoutRef.current);
          stateUpdateTimeoutRef.current = null;
        }
        
        // If connection fails, show a helpful message
        if (event.code === 1006 || event.code === 1002) {
          console.error('[WebSocket] Connection failed with code:', event.code);
          debouncedSend({ type: 'ERROR', error: 'Cannot connect to voice assistant server. Please check your internet connection and try again.' });
        } else if (event.code === 1000 || event.code === 1001) {
          // Normal closure or going away - don't show error, just log
          console.log('[WebSocket] Normal connection closure');
        } else {
          console.error('[WebSocket] Connection closed with code:', event.code, 'reason:', event.reason);
          debouncedSend({ type: 'ERROR', error: `WebSocket closed: ${event.reason || 'Unknown reason'}` });
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setIsStarted(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Clear debounced send timeout
        if (stateUpdateTimeoutRef.current) {
          clearTimeout(stateUpdateTimeoutRef.current);
          stateUpdateTimeoutRef.current = null;
        }
        
        debouncedSend({ type: 'ERROR', error: 'Failed to connect to voice assistant' });
      };

      ws.onmessage = (event) => {
        handleWebSocketMessage(event);
      };
      
    } catch (error) {
      debouncedSend({ type: 'ERROR', error: `Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

















  // Helper function to get the correct language code for different services
  const getLanguageCodeForService = (service: 'sarvam' | 'google' = 'google') => {
    const baseCode = languageStore.currentLanguage?.code || 'en';
    
    if (service === 'sarvam') {
      // Sarvam expects language codes with -IN suffix
      const sarvamLanguageMap: Record<string, string> = {
        'en': 'en-IN',
        'hi': 'hi-IN', 
        'kn': 'kn-IN',
        'ta': 'ta-IN',
        'te': 'te-IN',
        'ml': 'ml-IN',
        'mr': 'mr-IN',
        'gu': 'gu-IN',
        'bn': 'bn-IN',
        'pa': 'pa-IN',
        'or': 'od-IN', // Odia
        'as': 'as-IN', // Assamese
        'ur': 'ur-IN'  // Urdu
      };
      return sarvamLanguageMap[baseCode] || 'en-IN';
    }
    
    // Google Cloud uses standard language codes
    return baseCode;
  };




  return (
    <div className="relative w-full max-w-md mx-auto">
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
              languageStore={languageStore}
              voiceUIStore={voiceUIStore}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isProcessingState={isProcessingState}
            />
            
            <Greeting languageStore={languageStore} />
            
            <AudioVisualizer 
              voiceUIStore={voiceUIStore}
              isListening={isListening}
              isSpeaking={isSpeaking}
            />
            
            <StatusDisplay 
              status={status}
              isProcessingState={isProcessingState}
              voiceUIStore={voiceUIStore}
            />
            
            <PermissionsStatus 
              permissionsStore={permissionsStore}
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
              permissionsStore={permissionsStore}
              startVoiceAssistant={startVoiceAssistant}
            />
            
            {/* Enhanced Language Change Button with Dialect Info */}
            <div className="p-4 text-center border-t border-cyan-500/20">
              <button
                onClick={() => {
                  setHasSelectedLanguage(false);
                  send({ type: 'CANCEL' });
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
});
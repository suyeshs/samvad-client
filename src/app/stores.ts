/**
 * Stores.ts - State Management for Voice Assistant
 * 
 * Contains MobX stores for managing application state:
 * - PermissionsStore: Handles microphone and camera permissions
 * - LanguageStore: Manages language selection and preferences
 * - VoiceUIStore: Controls UI state for voice interactions
 * 
 * @author Developer Team
 * @version 1.0.0
 */
import { makeAutoObservable, runInAction } from 'mobx';
import { LanguageDetectionService, LanguageConfig, CFData, DEFAULT_LANGUAGES } from './services/LanguageDetectionService';

/**
 * Permissions Store
 * 
 * Manages browser permissions for microphone and camera access.
 * Handles permission requests, status tracking, and device support detection.
 * Uses MobX for reactive state management.
 */
export class PermissionsStore {
  audioPermission: 'granted' | 'denied' | 'prompt' | 'not-supported' = 'prompt';
  videoPermission: 'granted' | 'denied' | 'prompt' | 'not-supported' = 'prompt';
  audioPlaybackPermission: 'granted' | 'denied' | 'prompt' | 'not-supported' = 'prompt';
  isRequestingAudio = false;
  isRequestingVideo = false;
  isRequestingAudioPlayback = false;
  mediaDevicesSupported = false;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  /**
   * Check if media devices are supported by the browser
   * 
   * Detects whether the browser supports the MediaDevices API
   * and initializes permission states accordingly. This is called
   * during component initialization to set up proper permission handling.
   * 
   * @returns {void}
   */
  checkMediaDevicesSupport() {
    console.log('[Permissions] Checking media devices support...');
    console.log('[Permissions] typeof window:', typeof window);
    console.log('[Permissions] navigator.mediaDevices:', typeof window !== 'undefined' ? !!navigator.mediaDevices : 'N/A');
    
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      console.log('[Permissions] Media devices supported - setting up permissions');
      this.mediaDevicesSupported = true;
      this.audioPermission = 'prompt';
      this.videoPermission = 'prompt';
      this.checkExistingPermissions();
    } else {
      console.log('[Permissions] Media devices not supported');
      this.mediaDevicesSupported = false;
      this.audioPermission = 'not-supported';
      this.videoPermission = 'not-supported';
    }
  }
  
  async checkExistingPermissions() {
    console.log('[Permissions] Checking existing permissions...');
    if (!this.mediaDevicesSupported) {
      console.log('[Permissions] Media devices not supported, skipping permission check');
      return;
    }
    
    try {
      console.log('[Permissions] Querying microphone permission...');
      const audioPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.audioPermission = audioPermission.state;
      console.log('[Permissions] Audio permission state:', this.audioPermission);
      
      console.log('[Permissions] Querying camera permission...');
      const videoPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      this.videoPermission = videoPermission.state;
      console.log('[Permissions] Video permission state:', this.videoPermission);
    } catch (error) {
      console.warn('[Permissions] Could not check existing permissions:', error);
    }
  }
  
  /**
   * Request microphone permission from the user
   * 
   * Prompts the user for microphone access with optimized audio settings:
   * - Echo cancellation for better voice quality
   * - Noise suppression to reduce background noise
   * - Auto gain control for consistent volume levels
   * 
   * @returns {Promise<boolean>} True if permission granted, false otherwise
   */
  async requestAudioPermission() {
    if (!this.mediaDevicesSupported) {
      runInAction(() => {
        this.audioPermission = 'not-supported';
      });
      return false;
    }
    
    runInAction(() => {
      this.isRequestingAudio = true;
    });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      runInAction(() => {
        this.audioPermission = 'granted';
      });
      return true;
    } catch (error) {
      runInAction(() => {
        this.audioPermission = 'denied';
      });
      return false;
    } finally {
      runInAction(() => {
        this.isRequestingAudio = false;
      });
    }
  }
  
  async requestVideoPermission() {
    if (!this.mediaDevicesSupported) {
      runInAction(() => {
        this.videoPermission = 'not-supported';
      });
      return false;
    }
    
    runInAction(() => {
      this.isRequestingVideo = true;
    });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      stream.getTracks().forEach(track => track.stop());
      
      runInAction(() => {
        this.videoPermission = 'granted';
      });
      return true;
    } catch (error) {
      runInAction(() => {
        this.videoPermission = 'denied';
      });
      return false;
    } finally {
      runInAction(() => {
        this.isRequestingVideo = false;
      });
    }
  }
  
  /**
   * Request audio playback permission for Safari compatibility
   * 
   * Safari requires explicit user interaction before allowing audio playback.
   * This method creates a silent audio context and attempts to play a silent
   * audio buffer to unlock audio playback capabilities.
   * 
   * @returns {Promise<boolean>} True if playback permission granted, false otherwise
   */
  async requestAudioPlaybackPermission() {
    if (this.audioPlaybackPermission === 'granted') {
      return true;
    }
    
    runInAction(() => {
      this.isRequestingAudioPlayback = true;
    });
    
    try {
      // Create a silent audio context to unlock audio playback
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended (required for Safari)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create a silent audio buffer
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      // Play the silent audio to unlock audio capabilities
      source.start(0);
      source.stop(0.001);
      
      runInAction(() => {
        this.audioPlaybackPermission = 'granted';
      });
      
      console.log('[Permissions] Audio playback permission granted');
      return true;
    } catch (error) {
      console.warn('[Permissions] Audio playback permission failed:', error);
      runInAction(() => {
        this.audioPlaybackPermission = 'denied';
      });
      return false;
    } finally {
      runInAction(() => {
        this.isRequestingAudioPlayback = false;
      });
    }
  }
  
  get canUseAudio(): boolean {
    return this.mediaDevicesSupported && this.audioPermission === 'granted';
  }
  
  get needsAudioPermission(): boolean {
    return this.mediaDevicesSupported && this.audioPermission === 'prompt';
  }
  
  get canPlayAudio(): boolean {
    return this.audioPlaybackPermission === 'granted';
  }
  
  get needsAudioPlaybackPermission(): boolean {
    return this.audioPlaybackPermission === 'prompt';
  }
  
  get isSafari(): boolean {
    if (typeof window === 'undefined') return false;
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }
  
  get needsSafariAudioUnlock(): boolean {
    return this.isSafari && this.audioPlaybackPermission !== 'granted';
  }
}

export class LanguageStore {
  currentLanguage: LanguageConfig = DEFAULT_LANGUAGES[0];
  cfData: CFData | null = null;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  setCurrentLanguage(language: LanguageConfig) {
    this.currentLanguage = language;
  }
  
  setCfData(cfData: CFData) {
    this.cfData = cfData;
  }
  
  detectAndSetLanguage(cfData?: CFData) {
    const languageService = LanguageDetectionService.getInstance();
    const detectedLanguage = languageService.detectLanguage(cfData);
    this.setCurrentLanguage(detectedLanguage);
    if (cfData) {
      this.setCfData(cfData);
    }
  }
}

export class VoiceUIStore {
  audioBars: number[] = [];
  isPlaying = false;
  pendingAudio: Blob | null = null;
  volumeLevel = 0;
  isInterruptible = false;
  showLanguageSelector = false;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  setAudioBars(bars: number[]) {
    this.audioBars = bars.slice(0, 32);
  }
  
  setIsPlaying(val: boolean) {
    this.isPlaying = val;
  }
  
  setPendingAudio(blob: Blob | null) {
    this.pendingAudio = blob;
  }
  
  setVolumeLevel(level: number) {
    this.volumeLevel = level;
  }
  
  setIsInterruptible(val: boolean) {
    this.isInterruptible = val;
  }
  
  setShowLanguageSelector(val: boolean) {
    this.showLanguageSelector = val;
  }
  
  reset() {
    this.audioBars = [];
    this.isPlaying = false;
    this.pendingAudio = null;
    this.volumeLevel = 0;
    this.isInterruptible = false;
    this.showLanguageSelector = false;
  }
}
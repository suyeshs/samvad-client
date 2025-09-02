import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useLocalStorageBoolean,
  useLocalStorageString
} from "./useLocalStorage";

export type PermissionState = "granted" | "denied" | "prompt" | "not-supported";

export interface PermissionsState {
  // Permission states
  audioPermission: PermissionState;
  videoPermission: PermissionState;
  audioPlaybackPermission: PermissionState;

  // Request states
  isRequestingAudio: boolean;
  isRequestingVideo: boolean;
  isRequestingAudioPlayback: boolean;

  // Device support
  mediaDevicesSupported: boolean;

  // Computed getters
  canUseAudio: boolean;
  needsAudioPermission: boolean;
  canPlayAudio: boolean;
  needsAudioPlaybackPermission: boolean;
  isSafari: boolean;
  needsSafariAudioUnlock: boolean;

  // Methods
  checkMediaDevicesSupport: () => void;
  requestAudioPermission: () => Promise<boolean>;
  requestVideoPermission: () => Promise<boolean>;
  requestAudioPlaybackPermission: () => Promise<boolean>;
  checkExistingPermissions: () => Promise<void>;
}

export function usePermissions(): PermissionsState {
  // Persistent permissions in localStorage
  const [audioPermission, setAudioPermission] = useLocalStorageString(
    "audioPermission",
    "prompt"
  );
  const [videoPermission, setVideoPermission] = useLocalStorageString(
    "videoPermission",
    "prompt"
  );
  const [audioPlaybackPermission, setAudioPlaybackPermission] =
    useLocalStorageString("audioPlaybackPermission", "prompt");

  // Session-only states
  const [isRequestingAudio, setIsRequestingAudio] = useState(false);
  const [isRequestingVideo, setIsRequestingVideo] = useState(false);
  const [isRequestingAudioPlayback, setIsRequestingAudioPlayback] =
    useState(false);
  const [mediaDevicesSupported, setMediaDevicesSupported] = useState(false);

  // Check if media devices are supported
  const checkMediaDevicesSupport = useCallback(() => {
    if (typeof window !== "undefined" && navigator.mediaDevices) {
      setMediaDevicesSupported(true);

      // Only set to prompt if not already set
      if (audioPermission === "not-supported") {
        setAudioPermission("prompt");
      }
      if (videoPermission === "not-supported") {
        setVideoPermission("prompt");
      }

      checkExistingPermissions();
    } else {
      setMediaDevicesSupported(false);
      setAudioPermission("not-supported");
      setVideoPermission("not-supported");
    }
  }, [audioPermission, videoPermission]);

  // Check existing permissions
  const checkExistingPermissions = useCallback(async () => {
    try {
      const audioPermissionResult = await navigator.permissions.query({
        name: "microphone" as PermissionName
      });
      setAudioPermission(audioPermissionResult.state);

      const videoPermissionResult = await navigator.permissions.query({
        name: "camera" as PermissionName
      });
      setVideoPermission(videoPermissionResult.state);
    } catch (error) {
      console.warn(
        "[Permissions] Could not check existing permissions:",
        error
      );
    }
  }, []);

  // Check media devices support and existing permissions on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check media devices support first
      if (navigator.mediaDevices) {
        setMediaDevicesSupported(true);
        // Then check existing permissions
        checkExistingPermissions();
      } else {
        setMediaDevicesSupported(false);
        setAudioPermission("not-supported");
        setVideoPermission("not-supported");
      }
    }
  }, [checkExistingPermissions]);

  // Request microphone permission
  const requestAudioPermission = useCallback(async (): Promise<boolean> => {
    if (!mediaDevicesSupported) {
      setAudioPermission("not-supported");
      return false;
    }

    setIsRequestingAudio(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      stream.getTracks().forEach((track) => track.stop());

      setAudioPermission("granted");
      return true;
    } catch (error) {
      setAudioPermission("denied");
      return false;
    } finally {
      setIsRequestingAudio(false);
    }
  }, [mediaDevicesSupported]);

  // Request video permission
  const requestVideoPermission = useCallback(async (): Promise<boolean> => {
    if (!mediaDevicesSupported) {
      setVideoPermission("not-supported");
      return false;
    }

    setIsRequestingVideo(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      setVideoPermission("granted");
      return true;
    } catch (error) {
      setVideoPermission("denied");
      return false;
    } finally {
      setIsRequestingVideo(false);
    }
  }, [mediaDevicesSupported]);

  // Request audio playback permission (Safari compatibility)
  const requestAudioPlaybackPermission =
    useCallback(async (): Promise<boolean> => {
      if (audioPlaybackPermission === "granted") {
        return true;
      }

      setIsRequestingAudioPlayback(true);

      try {
        // Create a silent audio context to unlock audio playback
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();

        // Resume audio context if suspended (required for Safari)
        if (audioContext.state === "suspended") {
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

        setAudioPlaybackPermission("granted");

        return true;
      } catch (error) {
        console.warn("[Permissions] Audio playback permission failed:", error);
        setAudioPlaybackPermission("denied");
        return false;
      } finally {
        setIsRequestingAudioPlayback(false);
      }
    }, [audioPlaybackPermission]);

  // Computed getters
  const canUseAudio = mediaDevicesSupported && audioPermission === "granted";
  const needsAudioPermission =
    mediaDevicesSupported && audioPermission === "prompt";
  const canPlayAudio = audioPlaybackPermission === "granted";
  const needsAudioPlaybackPermission = audioPlaybackPermission === "prompt";

  // Safari detection
  const isSafari =
    typeof window !== "undefined" &&
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const needsSafariAudioUnlock =
    isSafari && audioPlaybackPermission !== "granted";

  // Initialize on mount
  useEffect(() => {
    checkMediaDevicesSupport();
  }, [checkMediaDevicesSupport]);

  // Memoize the return value to prevent infinite re-renders
  return useMemo(
    () => ({
      // State
      audioPermission: audioPermission as PermissionState,
      videoPermission: videoPermission as PermissionState,
      audioPlaybackPermission: audioPlaybackPermission as PermissionState,
      isRequestingAudio,
      isRequestingVideo,
      isRequestingAudioPlayback,
      mediaDevicesSupported,

      // Computed getters
      canUseAudio,
      needsAudioPermission,
      canPlayAudio,
      needsAudioPlaybackPermission,
      isSafari,
      needsSafariAudioUnlock,

      // Methods
      checkMediaDevicesSupport,
      requestAudioPermission,
      requestVideoPermission,
      requestAudioPlaybackPermission,
      checkExistingPermissions
    }),
    [
      audioPermission,
      videoPermission,
      audioPlaybackPermission,
      isRequestingAudio,
      isRequestingVideo,
      isRequestingAudioPlayback,
      mediaDevicesSupported,
      canUseAudio,
      needsAudioPermission,
      canPlayAudio,
      needsAudioPlaybackPermission,
      isSafari,
      needsSafariAudioUnlock,
      checkMediaDevicesSupport,
      requestAudioPermission,
      requestVideoPermission,
      requestAudioPlaybackPermission,
      checkExistingPermissions
    ]
  );
}

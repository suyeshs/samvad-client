/**
 * Audio Utilities for Voice Assistant
 * 
 * Provides essential audio processing functions for the voice assistant:
 * - WAV format conversion for audio streaming
 * - Base64 encoding for data transmission
 * - Memory cleanup for blob URLs
 * 
 * @author Developer Team
 * @version 1.0.0
 */

/**
 * Convert Float32Array audio data to WAV format
 * 
 * Creates a properly formatted WAV file from raw audio data.
 * Used for sending audio data to the speech-to-text service.
 * 
 * @param {Float32Array} audioData - Raw audio samples
 * @param {number} sampleRate - Audio sample rate (default: 16000 Hz)
 * @returns {Uint8Array} WAV file as byte array
 */
export function float32ArrayToWav(audioData: Float32Array, sampleRate: number = 16000): Uint8Array {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, audioData.length * 2, true);
  
  // Convert Float32Array to 16-bit PCM
  const offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset + i * 2, sample * 0x7FFF, true);
  }
  
  return new Uint8Array(buffer);
}

/**
 * Efficient base64 conversion without spreading large arrays
 * 
 * Converts Uint8Array to base64 string for data transmission.
 * Uses a loop-based approach to avoid memory issues with large arrays.
 * 
 * @param {Uint8Array} bytes - Byte array to convert
 * @returns {string} Base64 encoded string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
} 

/**
 * Clean up orphaned blob URLs that might be causing errors
 * 
 * Removes unused blob URLs from memory to prevent memory leaks
 * and audio playback issues. This is especially important for
 * long-running voice assistant sessions.
 * 
 * @returns {void}
 */
export function cleanupOrphanedBlobUrls(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    console.log('[AudioUtils] Cleaning up orphaned blob URLs...');
    
    // Find all audio elements with blob URLs
    const allAudioElements = document.querySelectorAll('audio');
    let cleanedCount = 0;
    
    allAudioElements.forEach(audio => {
      if (audio.src && audio.src.startsWith('blob:')) {
        console.log('[AudioUtils] Found orphaned blob URL:', audio.src);
        try {
          audio.pause();
          audio.src = '';
          audio.load();
          cleanedCount++;
        } catch (error) {
          console.error('[AudioUtils] Error cleaning audio element:', error);
        }
      }
    });
    
    console.log(`[AudioUtils] Cleaned up ${cleanedCount} orphaned blob URLs`);
    
    // Force garbage collection if available (Chrome only)
    if (window.gc) {
      try {
        window.gc();
        console.log('[AudioUtils] Forced garbage collection');
      } catch (error) {
        // Ignore if not available
      }
    }
  } catch (error) {
    console.error('[AudioUtils] Error in cleanupOrphanedBlobUrls:', error);
  }
}

// Global cleanup function that can be called from anywhere (browser only)
if (typeof window !== 'undefined') {
  (window as any).cleanupOrphanedBlobUrls = cleanupOrphanedBlobUrls;
} 
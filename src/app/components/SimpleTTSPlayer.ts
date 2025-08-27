export class SimpleTTSPlayer {
  private audioChunks: Uint8Array[] = [];
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private audioUrl: string | null = null;
  private abortController: AbortController | null = null;
  private hasError: boolean = false;

  addChunk(chunk: Uint8Array) {
    console.log('[TTS] Adding chunk:', {
      chunkLength: chunk.length,
      totalChunks: this.audioChunks.length + 1,
      firstFewBytes: Array.from(chunk.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    this.audioChunks.push(chunk);
  }

  async play() {
    console.log('[TTS] Play called with chunks:', {
      chunksCount: this.audioChunks.length,
      chunksLengths: this.audioChunks.map(chunk => chunk.length),
      totalLength: this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    });
    
    if (this.audioChunks.length === 0) {
      console.log('[TTS] No audio chunks to play');
      return;
    }
    
    // Ensure audio context is resumed before playing
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('[TTS] Audio context state:', audioContext.state);
      
      if (audioContext.state === 'suspended') {
        console.log('[TTS] Resuming suspended audio context...');
        await audioContext.resume();
        console.log('[TTS] Audio context resumed, new state:', audioContext.state);
      }
      
      // Wait a bit for the context to stabilize
      if (audioContext.state === 'running') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (contextError) {
      console.error('[TTS] Audio context initialization failed:', contextError);
    }
    
    // Validate audio chunks
    const hasValidChunks = this.audioChunks.every(chunk => chunk && chunk.length > 0);
    if (!hasValidChunks) {
      console.error('[TTS] Invalid audio chunks detected');
      this.cleanup();
      return;
    }
    
    // Check if we have any actual audio data
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength === 0) {
      console.error('[TTS] No audio data to play - total length is 0');
      this.cleanup();
      return;
    }
    
    // Stop any existing audio element but preserve chunks
    this.stopAudioElement();
    
    try {
      const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      console.log('[TTS] Audio data info:', {
        chunks: this.audioChunks.length,
        totalLength,
        firstChunkLength: this.audioChunks[0]?.length,
        lastChunkLength: this.audioChunks[this.audioChunks.length - 1]?.length
      });
      
      const audioData = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const chunk of this.audioChunks) {
        audioData.set(chunk, offset);
        offset += chunk.length;
      }

      // Check audio format by examining first few bytes
      const firstBytes = audioData.slice(0, 12);
      const isWav = firstBytes.length >= 4 && 
        String.fromCharCode(...firstBytes.slice(0, 4)) === 'RIFF';
      const isMp3 = firstBytes.length >= 3 && 
        (firstBytes[0] === 0xFF && (firstBytes[1] & 0xE0) === 0xE0);
      const isOgg = firstBytes.length >= 4 && 
        String.fromCharCode(...firstBytes.slice(0, 4)) === 'OggS';
      
      let mimeType = 'audio/wav'; // default
      if (isMp3) mimeType = 'audio/mpeg';
      else if (isOgg) mimeType = 'audio/ogg';
      else if (!isWav) mimeType = 'audio/mpeg'; // fallback
      
      const blob = new Blob([audioData], { type: mimeType });
      console.log('[TTS] Blob created:', {
        size: blob.size,
        type: blob.type,
        detectedFormat: { isWav, isMp3, isOgg },
        mimeType,
        firstBytes: Array.from(audioData.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      });
      
      // Validate blob before creating URL
      if (blob.size === 0) {
        console.error('[TTS] Blob size is 0, cannot create URL');
        this.cleanup();
        return;
      }
      
      this.audioUrl = URL.createObjectURL(blob);
      console.log('[TTS] Created blob URL:', this.audioUrl);
      
      // Validate the blob URL was created successfully
      if (!this.audioUrl || this.audioUrl === 'null') {
        console.error('[TTS] Failed to create blob URL');
        this.cleanup();
        return;
      }
      
      this.audioElement = new Audio();
      this.isPlaying = true;
      this.abortController = new AbortController();
      
      // Set up event listeners before setting src
      this.audioElement.onended = () => {
        this.cleanup();
      };
      
      this.audioElement.onerror = (error) => {
        // Capture error details immediately
        const errorDetails = {
          error: this.audioElement?.error,
          networkState: this.audioElement?.networkState,
          readyState: this.audioElement?.readyState,
          src: this.audioElement?.src,
          blobUrl: this.audioUrl,
          audioElementExists: !!this.audioElement,
          audioContextState: this.getAudioContextState()
        };
        
        console.warn('[TTS] Audio playback error (expected in some browsers):', error);
        console.warn('[TTS] Audio element error details:', errorDetails);
        
        // Set a flag to indicate error occurred
        this.hasError = true;
        this.isPlaying = false;
        
        // Don't call cleanup immediately, let the main error handler deal with it
        console.log('[TTS] Audio error occurred, will be handled by main error handler');
        
        // Trigger a custom event to notify the parent component
        const errorEvent = new CustomEvent('ttsError', { 
          detail: { error, errorDetails } 
        });
        window.dispatchEvent(errorEvent);
      };
      
      this.audioElement.onpause = () => {
        this.isPlaying = false;
      };
      
      // Set src after event listeners are set up
      this.audioElement.src = this.audioUrl;
      console.log('[TTS] Set audio src:', this.audioUrl);
      
      // Preload the audio to ensure it's available
      this.audioElement.preload = 'auto';
      
      // Check if we should abort before playing
      if (this.abortController.signal.aborted) {
        this.cleanup();
        return;
      }
      
      // Wait for the audio element to load with better error handling
      await new Promise<void>((resolve, reject) => {
        const loadTimeout = setTimeout(() => {
          console.warn('[TTS] Audio loading timeout, attempting to continue anyway');
          // Don't reject immediately, try to continue
          resolve();
        }, 5000); // Increased timeout
        
        const onLoadedData = () => {
          clearTimeout(loadTimeout);
          this.audioElement?.removeEventListener('loadeddata', onLoadedData);
          this.audioElement?.removeEventListener('error', onLoadError);
          this.audioElement?.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        
        const onCanPlay = () => {
          clearTimeout(loadTimeout);
          this.audioElement?.removeEventListener('loadeddata', onLoadedData);
          this.audioElement?.removeEventListener('error', onLoadError);
          this.audioElement?.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        
        const onLoadError = (error: Event) => {
          clearTimeout(loadTimeout);
          this.audioElement?.removeEventListener('loadeddata', onLoadedData);
          this.audioElement?.removeEventListener('error', onLoadError);
          this.audioElement?.removeEventListener('canplay', onCanPlay);
          
          console.warn('[TTS] Audio load error, but continuing:', error);
          // Don't reject immediately, try to continue
          resolve();
        };
        
        this.audioElement?.addEventListener('loadeddata', onLoadedData);
        this.audioElement?.addEventListener('canplay', onCanPlay);
        this.audioElement?.addEventListener('error', onLoadError);
      });
      
      // Check if audio element is in error state
      if (this.audioElement?.error) {
        console.error('[TTS] Audio element has error before playing:', this.audioElement.error);
        
        // Try to recreate the blob URL if it might be corrupted
        if (this.audioUrl && this.audioChunks.length > 0) {
          console.log('[TTS] Attempting to recreate blob URL due to error');
          try {
            // Revoke the old URL
            URL.revokeObjectURL(this.audioUrl);
            
            // Recreate the blob and URL
            const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const audioData = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of this.audioChunks) {
              audioData.set(chunk, offset);
              offset += chunk.length;
            }
            
            const blob = new Blob([audioData], { type: 'audio/mpeg' });
            this.audioUrl = URL.createObjectURL(blob);
            this.audioElement.src = this.audioUrl;
            console.log('[TTS] Recreated blob URL:', this.audioUrl);
          } catch (retryError) {
            console.error('[TTS] Failed to recreate blob URL:', retryError);
            this.cleanup();
            return;
          }
        } else {
          this.cleanup();
          return;
        }
      }
      
          // Check if blob URL is still valid
    if (!this.audioUrl) {
      console.error('[TTS] No blob URL available for playing');
      this.cleanup();
      return;
    }
    
    // Validate blob URL format
    if (!this.audioUrl.startsWith('blob:')) {
      console.error('[TTS] Invalid blob URL format:', this.audioUrl);
      this.cleanup();
      return;
    }
    
    // Check if there's already an error
    if (this.hasError) {
      console.error('[TTS] Audio has error, cannot play');
      this.cleanup();
      return;
    }
      
      // Ensure the audio element is ready before playing
      if (this.audioElement.readyState >= 2) { // HAVE_CURRENT_DATA
        await this.audioElement.play();
      } else {
        // Wait for the audio to be ready with timeout
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.audioElement?.removeEventListener('canplay', onCanPlay);
            this.audioElement?.removeEventListener('error', onError);
            reject(new Error('Audio loading timeout'));
          }, 5000); // 5 second timeout
          
          const onCanPlay = () => {
            clearTimeout(timeout);
            this.audioElement?.removeEventListener('canplay', onCanPlay);
            this.audioElement?.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            clearTimeout(timeout);
            this.audioElement?.removeEventListener('canplay', onCanPlay);
            this.audioElement?.removeEventListener('error', onError);
            
            // Check if we already have error details
            if (this.hasError) {
              reject(new Error('Audio failed to load'));
            } else {
              reject(new Error('Audio loading timeout'));
            }
          };
          this.audioElement?.addEventListener('canplay', onCanPlay);
          this.audioElement?.addEventListener('error', onError);
        });
        await this.audioElement.play();
      }
      
          } catch (error) {
        console.error('[TTS] Play method error:', error);
        
        // Handle specific audio permission errors
        if (error instanceof Error && error.name === 'NotAllowedError') {
          console.log('[TTS] Audio permission denied, attempting to resume audio context...');
          
          // Try to resume audio context if it's suspended
          try {
            if (this.audioElement) {
              // Create a new audio context and resume it
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              console.log('[TTS] Retry - Audio context state:', audioContext.state);
              
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
                console.log('[TTS] Retry - Audio context resumed');
              }
              
              // Wait for context to stabilize
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Try playing again after a short delay
              setTimeout(async () => {
                try {
                  if (this.audioElement && this.isPlaying && !this.hasError) {
                    console.log('[TTS] Retrying audio playback...');
                    await this.audioElement.play();
                    console.log('[TTS] Retry successful');
                  } else {
                    console.log('[TTS] Retry skipped - conditions not met');
                    this.hasError = true;
                    this.cleanup();
                  }
                } catch (retryError) {
                  console.error('[TTS] Retry play failed:', retryError);
                  this.hasError = true;
                  this.cleanup();
                }
              }, 300);
              return; // Don't cleanup immediately, let retry happen
            }
          } catch (contextError) {
            console.error('[TTS] Audio context resume failed:', contextError);
          }
        }
        
        this.hasError = true;
        this.cleanup();
      }
  }

  stop() {
    console.log('[TTS] Stop called, chunks before stop:', this.audioChunks.length);
    this.isPlaying = false;
    
    // Signal abort for any pending operations
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = '';
        this.audioElement.load(); // Force reload to clear any cached audio
      } catch (error) {
        // Silent cleanup
      }
      this.audioElement = null;
    }
    
    this.cleanup();
  }
  
  // Stop only the audio element without clearing chunks
  private stopAudioElement() {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.src = '';
        this.audioElement.load();
      } catch (error) {
        // Silent cleanup
      }
      this.audioElement = null;
    }
  }

  private cleanup() {
    console.log('[TTS] Cleanup called, chunks before cleanup:', this.audioChunks.length);
    this.isPlaying = false;
    this.hasError = false;
    
    // Clear audio element first
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.src = '';
        this.audioElement.load();
      } catch (error) {
        // Silent cleanup
      }
      this.audioElement = null;
    }
    
    // Revoke blob URL with much longer delay to ensure audio element is fully cleared
    // and any pending requests are completed
    if (this.audioUrl) {
      setTimeout(() => {
        if (this.audioUrl) {
          try {
            console.log('[TTS] Revoking blob URL:', this.audioUrl);
            URL.revokeObjectURL(this.audioUrl);
          } catch (error) {
            console.error('[TTS] Error revoking blob URL:', error);
          }
          this.audioUrl = null;
        }
      }, 3000); // Increased delay to 3 seconds to prevent race conditions
    }
    
    // Only clear chunks if we're not in the middle of playing and no retry is happening
    if (!this.isPlaying && !this.hasError) {
      this.audioChunks = [];
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying && this.audioElement !== null;
  }

  getChunkCount(): number {
    return this.audioChunks.length;
  }

  private getAudioContextState(): string {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      return audioContext.state;
    } catch (error) {
      return 'unknown';
    }
  }

  // Force stop all audio contexts and elements
  forceStop() {
    this.stop();
    
    // Additional cleanup for any remaining audio contexts
    try {
      // Stop any other audio elements that might be playing
      const allAudioElements = document.querySelectorAll('audio');
      allAudioElements.forEach(audio => {
        if (audio !== this.audioElement) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
      
      // Force cleanup of any remaining blob URLs
      this.cleanupOrphanedBlobUrls();
    } catch (error) {
      console.error('[TTS] Error in forceStop:', error);
    }
  }
  
  // Clean up any orphaned blob URLs
  private cleanupOrphanedBlobUrls() {
    try {
      // This is a more aggressive cleanup approach
      // Note: This is a workaround since we can't directly access all blob URLs
      const allAudioElements = document.querySelectorAll('audio');
      allAudioElements.forEach(audio => {
        if (audio.src && audio.src.startsWith('blob:')) {
          console.log('[TTS] Found orphaned blob URL:', audio.src);
          audio.src = '';
          audio.load();
        }
      });
    } catch (error) {
      console.error('[TTS] Error cleaning up orphaned blob URLs:', error);
    }
  }
}

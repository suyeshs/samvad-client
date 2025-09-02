/**
 * VoiceService - Simplified HTTP-based voice processing
 *
 * Replaces WebSocket complexity with simple HTTP API calls
 */

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  text?: string;
  language?: string;
  error?: string;
}

export class VoiceService {
  private static instance: VoiceService;

  private constructor() {}

  static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  /**
   * Process voice audio and get AI response
   */
  async processVoice(
    audioBlob: Blob,
    language: string
  ): Promise<VoiceResponse> {
    try {
      console.log("[VoiceService] Processing voice request:", {
        audioSize: audioBlob.size,
        language,
        audioType: audioBlob.type
      });

      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.wav");
      formData.append("language", language);

      const response = await fetch("/api/voice", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log("[VoiceService] Response received:", {
        success: result.success,
        hasAudioUrl: !!result.audioUrl,
        hasText: !!result.text
      });

      return result;
    } catch (error) {
      console.error("[VoiceService] Error processing voice:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Play audio from URL
   */
  async playAudio(audioUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          console.log("[VoiceService] Audio playback completed");
          resolve(true);
        };

        audio.onerror = (error) => {
          console.error("[VoiceService] Audio playback error:", error);
          resolve(false);
        };

        audio.onloadstart = () => {
          console.log("[VoiceService] Audio loading started");
        };

        audio.oncanplay = () => {
          console.log("[VoiceService] Audio ready to play");
        };

        audio
          .play()
          .then(() => {
            console.log("[VoiceService] Audio playback started");
          })
          .catch((error) => {
            console.error("[VoiceService] Audio play failed:", error);
            resolve(false);
          });
      } catch (error) {
        console.error("[VoiceService] Audio setup error:", error);
        resolve(false);
      }
    });
  }
}

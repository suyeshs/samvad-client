/**
 * HttpVoiceService - Minimal HTTP replacement for WebSocket communication
 *
 * Only replaces the server communication, keeps everything else identical
 */

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  text?: string;
  language?: string;
  error?: string;
}

export class HttpVoiceService {
  private static instance: HttpVoiceService;

  private constructor() {}

  static getInstance(): HttpVoiceService {
    if (!HttpVoiceService.instance) {
      HttpVoiceService.instance = new HttpVoiceService();
    }
    return HttpVoiceService.instance;
  }

  /**
   * Process voice audio and get AI response (replaces WebSocket audio sending)
   */
  async processVoice(
    audioBlob: Blob,
    language: string
  ): Promise<VoiceResponse> {
    try {
      console.log("[HttpVoice] Processing voice request:", {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("[HttpVoice] Received response:", result);

      return result;
    } catch (error) {
      console.error("[HttpVoice] Request failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

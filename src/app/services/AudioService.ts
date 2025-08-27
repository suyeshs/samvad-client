// src/services/AudioService.ts
import { LanguageConfig } from './LanguageDetectionService';

export class AudioService {
    private static instance: AudioService;
    private audioContext: AudioContext | null = null;
  
    private constructor() {}
  
    static getInstance(): AudioService {
      if (!AudioService.instance) {
        AudioService.instance = new AudioService();
      }
      return AudioService.instance;
    }
  
    async playGreeting(language: LanguageConfig): Promise<void> {
      if (!language.greeting) return;
      
      try {
        this.speakGreeting(language.greeting, language.code);
      } catch (error) {
        console.error('[Audio] Error playing greeting:', error);
      }
    }
  
    private speakGreeting(text: string, languageCode: string): void {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageCode;
        utterance.rate = 0.9;
        utterance.pitch = 1.1; // Slightly higher pitch for female voice
        
        // Try to select a female voice
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
          voice.lang.startsWith(languageCode) && 
          (voice.name.toLowerCase().includes('female') || 
           voice.name.toLowerCase().includes('woman') ||
           voice.name.toLowerCase().includes('samantha') ||
           voice.name.toLowerCase().includes('karen') ||
           voice.name.toLowerCase().includes('moira') ||
           voice.name.toLowerCase().includes('fiona'))
        );
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        
        speechSynthesis.speak(utterance);
      }
    }
  
    stopAll(): void {
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    }
  }
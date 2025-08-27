// src/components/AudioVisualizer.tsx
import React from 'react';
import { VoiceUIStore } from '../stores';

export const AudioVisualizer = ({ voiceUIStore, isListening, isSpeaking }: {
    voiceUIStore: VoiceUIStore;
    isListening: boolean;
    isSpeaking: boolean;
  }) => {
    return (
      <div className="px-6 py-6">
        {/* Radial Audio Visualizer */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="relative w-48 h-48">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-xl"></div>
            
            <div className="relative w-full h-full">
              {Array.from({ length: 32 }).map((_, index) => {
                const angle = (index * 360) / 32;
                const barHeight = voiceUIStore.audioBars.length > 0 
                  ? (voiceUIStore.audioBars[index % voiceUIStore.audioBars.length] || 5)
                  : (isListening || isSpeaking ? ((index * 7) % 30) + 10 : 5);
                const hue = 180 + (index / 32) * 120;
                const color = `hsl(${hue}, 70%, 60%)`;
                
                return (
                  <div
                    key={index}
                    className="absolute origin-bottom transition-all duration-75 ease-out"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                      width: '4px',
                      height: `${Math.max(barHeight, 4)}px`,
                      backgroundColor: color,
                      boxShadow: `0 0 10px ${color}`,
                      borderRadius: '2px',
                      opacity: barHeight > 15 ? 1 : barHeight > 8 ? 0.8 : 0.5
                    }}
                  />
                );
              })}
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isSpeaking ? 'bg-red-500/20 border-2 border-red-500' :
                isListening ? 'bg-cyan-500/20 border-2 border-cyan-500' :
                'bg-green-500/20 border-2 border-green-500'
              }`}>
                <div className={`text-2xl ${
                  isSpeaking ? 'text-red-400' :
                  isListening ? 'text-cyan-400' :
                  'text-green-400'
                }`}>
                  {isSpeaking ? '🔊' : isListening ? '🎤' : '✨'}
                </div>
              </div>
            </div>
          </div>
        </div>
  
        {/* Horizontal Audio Waveform */}
        <div className="flex items-center justify-center space-x-1 mb-6">
          {voiceUIStore.audioBars.slice(0, 20).map((height: number, index: number) => {
            const hue = 180 + (index / Math.max(voiceUIStore.audioBars.length, 1)) * 120;
            const color = `hsl(${hue}, 70%, 60%)`;
            
            return (
              <div
                key={index}
                className="rounded-full transition-all duration-75 ease-out"
                style={{ 
                  width: '5px',
                  height: `${Math.max(Math.min(height, 70), 4)}px`,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                  minHeight: '4px',
                  maxHeight: '70px',
                  opacity: height > 15 ? 1 : height > 8 ? 0.8 : 0.6
                }}
              />
            );
          })}
        </div>
  

      </div>
    );
  };
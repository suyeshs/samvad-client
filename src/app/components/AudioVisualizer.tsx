// src/components/AudioVisualizer.tsx
import React from "react";
import { AudioVisualizationState } from "../hooks/useAudioVisualization";

export const AudioVisualizer = ({
  audioViz,
  isListening,
  isSpeaking
}: {
  audioViz: AudioVisualizationState;
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
              const barHeight =
                audioViz.audioBars.length > 0
                  ? audioViz.audioBars[index % audioViz.audioBars.length] || 5
                  : isListening || isSpeaking
                  ? ((index * 7) % 30) + 10
                  : 5;
              const hue = 180 + (index / 32) * 120;
              const color = `hsl(${hue}, 70%, 60%)`;

              return (
                <div
                  key={index}
                  className="absolute origin-bottom transition-all duration-75 ease-out"
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    width: "4px",
                    height: `${Math.max(barHeight, 4)}px`,
                    backgroundColor: color,
                    boxShadow: `0 0 10px ${color}`,
                    borderRadius: "2px",
                    opacity: barHeight > 15 ? 1 : barHeight > 8 ? 0.8 : 0.5
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

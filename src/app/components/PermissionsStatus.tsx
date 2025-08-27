// src/components/PermissionsStatus.tsx
import React from 'react';
import { observer } from 'mobx-react-lite';
import { PermissionsStore } from '../stores';

export const PermissionsStatus = observer(({ permissionsStore, handleRequestPermissions }: {
    permissionsStore: PermissionsStore;
    handleRequestPermissions: () => void;
  }) => {
    console.log('[PermissionsStatus] Rendering with state:', {
      mediaDevicesSupported: permissionsStore.mediaDevicesSupported,
      audioPermission: permissionsStore.audioPermission,
      canUseAudio: permissionsStore.canUseAudio,
      needsAudioPermission: permissionsStore.needsAudioPermission
    });
    
    return (
      <>
        {!permissionsStore.mediaDevicesSupported && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
            <div className="text-yellow-300 text-sm">
              ⚠️ Media devices not supported in this environment
            </div>
          </div>
        )}
        
        {permissionsStore.mediaDevicesSupported && permissionsStore.needsAudioPermission && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
            <div className="text-blue-300 text-sm mb-2">
              🎤 Microphone permission required to use voice assistant
            </div>
            <button
              onClick={handleRequestPermissions}
              disabled={permissionsStore.isRequestingAudio}
              className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm border border-blue-500/50"
            >
              {permissionsStore.isRequestingAudio ? '⏳ Requesting...' : '🔐 Grant Microphone Permission'}
            </button>
          </div>
        )}
        
        {permissionsStore.audioPermission === 'denied' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
            <div className="text-red-300 text-sm mb-2">
              🚫 Microphone access denied. Please enable microphone permissions in your browser settings.
            </div>
            <button
              onClick={handleRequestPermissions}
              className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm border border-red-500/50"
            >
              🔄 Try Again
            </button>
          </div>
        )}
        
        {permissionsStore.audioPermission === 'not-supported' && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
            <div className="text-orange-300 text-sm">
              🔧 Microphone not supported in this environment
            </div>
          </div>
        )}
        

      </>
    );
  });
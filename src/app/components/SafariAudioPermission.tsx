import React from 'react';
import { observer } from 'mobx-react-lite';
import { PermissionsStore } from '../stores';

interface SafariAudioPermissionProps {
  permissionsStore: PermissionsStore;
  onPermissionGranted: () => void;
}

export const SafariAudioPermission = observer(({ 
  permissionsStore, 
  onPermissionGranted 
}: SafariAudioPermissionProps) => {
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setError(null);
    
    try {
      const granted = await permissionsStore.requestAudioPlaybackPermission();
      if (granted) {
        onPermissionGranted();
      } else {
        setError('Audio playback permission was denied. Please allow audio in your browser settings.');
      }
    } catch (err) {
      setError('Failed to request audio permission. Please try again.');
      console.error('[SafariAudioPermission] Error:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!permissionsStore.isSafari || permissionsStore.canPlayAudio) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-6 max-w-md mx-4 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Audio Permission Required
          </h3>
          <p className="text-cyan-200/80 text-sm leading-relaxed">
            Safari requires explicit permission to play audio. Please click the button below to enable audio playback for the voice assistant.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
          >
            {isRequesting ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Enabling Audio...
              </div>
            ) : (
              'Enable Audio Playback'
            )}
          </button>
          
          <p className="text-cyan-300/60 text-xs">
            This is a one-time setup for Safari browsers
          </p>
        </div>
      </div>
    </div>
  );
}); 
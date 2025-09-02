# React Hooks Architecture - Replacing MobX

This directory contains custom React hooks that replace the MobX stores with a simpler, more predictable state management approach.

## Architecture Overview

### **Before (MobX):**

- 3 separate MobX stores
- Reactive updates causing race conditions
- Complex state synchronization with XState
- Multiple sources of truth for UI state

### **After (React Hooks + localStorage):**

- Custom hooks for specific concerns
- localStorage persistence for user preferences
- React state for session-only data
- Single source of truth per concern

## Available Hooks

### 1. `useLocalStorage<T>`

Generic hook for localStorage persistence with type safety.

```typescript
const [value, setValue] = useLocalStorage("key", initialValue);

// With custom serialization
const [date, setDate] = useLocalStorage("lastVisit", new Date(), {
  serialize: (date) => date.toISOString(),
  deserialize: (str) => new Date(str)
});
```

### 2. `usePermissions`

Manages browser permissions with localStorage persistence.

```typescript
const permissions = usePermissions();

// Check if user can use audio
if (permissions.canUseAudio) {
  // Start voice assistant
}

// Request permission
await permissions.requestAudioPermission();
```

**Persists in localStorage:**

- `audioPermission`: 'granted' | 'denied' | 'prompt' | 'not-supported'
- `videoPermission`: 'granted' | 'denied' | 'prompt' | 'not-supported'
- `audioPlaybackPermission`: 'granted' | 'denied' | 'prompt' | 'not-supported'

### 3. `useLanguagePreferences`

Manages language selection with localStorage persistence.

```typescript
const languagePrefs = useLanguagePreferences();

// Get current language
const currentLang = languagePrefs.currentLanguage;

// Change language
languagePrefs.setCurrentLanguage(newLanguage);
```

**Persists in localStorage:**

- `preferredLanguage`: Language code (e.g., 'en', 'hi', 'kn')
- `cfData`: Cloudflare geolocation data

### 4. `useAudioVisualization`

Manages audio visualization state (session-only, no persistence needed).

```typescript
const audioViz = useAudioVisualization();

// Start TTS visualization
audioViz.startAudioBars();

// Stop visualization
audioViz.stopAudioBars();

// Update playing state
audioViz.setIsPlaying(true);
```

## Migration Strategy

### **Phase 1: Replace MobX Stores**

```typescript
// OLD (MobX)
import { PermissionsStore, LanguageStore, VoiceUIStore } from "./stores";
const permissionsStore = new PermissionsStore();

// NEW (React Hooks)
import {
  usePermissions,
  useLanguagePreferences,
  useAudioVisualization
} from "./hooks";
const permissions = usePermissions();
```

### **Phase 2: Update Component Props**

```typescript
// OLD
<PermissionsStatus permissionsStore={permissionsStore} />

// NEW
<PermissionsStatus permissions={permissions} />
```

### **Phase 3: Remove MobX Dependencies**

```bash
yarn remove mobx mobx-react-lite
```

## Benefits of This Approach

### **1. Simpler State Management**

- No more reactive updates causing race conditions
- Predictable state changes
- Easier debugging

### **2. Better Performance**

- No unnecessary re-renders from MobX observables
- React's built-in optimization works better
- Smaller bundle size

### **3. localStorage Persistence**

- User preferences survive browser sessions
- No need for complex persistence logic
- Automatic sync across tabs

### **4. Type Safety**

- Full TypeScript support
- Better IntelliSense
- Compile-time error checking

### **5. Easier Testing**

- Hooks can be tested independently
- No need to mock MobX stores
- Simpler unit tests

## Example Usage in Components

```typescript
import React from "react";
import { usePermissions } from "./hooks/usePermissions";
import { useLanguagePreferences } from "./hooks/useLanguagePreferences";

export function MyComponent() {
  const permissions = usePermissions();
  const languagePrefs = useLanguagePreferences();

  const handleStart = async () => {
    if (permissions.canUseAudio) {
      await permissions.requestAudioPermission();
      // Start voice assistant
    }
  };

  return (
    <div>
      <h1>Current Language: {languagePrefs.currentLanguage.name}</h1>
      <button onClick={handleStart} disabled={!permissions.canUseAudio}>
        Start Voice Assistant
      </button>
    </div>
  );
}
```

## localStorage Keys Used

- `audioPermission`: Microphone permission state
- `videoPermission`: Camera permission state
- `audioPlaybackPermission`: Audio playback permission
- `preferredLanguage`: User's preferred language code
- `cfData`: Cloudflare geolocation data

## Browser Compatibility

- **localStorage**: All modern browsers (IE8+)
- **Permissions API**: Chrome 46+, Firefox 46+, Safari 13.1+
- **MediaDevices API**: Chrome 53+, Firefox 36+, Safari 11+

## Error Handling

All hooks include error handling for localStorage operations:

- Graceful fallback to initial values if localStorage fails
- Console warnings for debugging
- No crashes if localStorage is unavailable

## Future Enhancements

- **IndexedDB**: For larger data storage needs
- **Service Worker**: For offline persistence
- **Sync API**: For cross-device preferences
- **Encryption**: For sensitive user data

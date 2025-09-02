import { useState, useEffect } from "react";

/**
 * Custom hook for localStorage persistence
 * Provides a React state interface that automatically syncs with localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
): [T, (value: T | ((val: T) => T)) => void] {
  const { serialize = JSON.stringify, deserialize = JSON.parse } =
    options || {};

  // Get from localStorage or use initial value
  // Always start with initialValue to prevent hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after hydration
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(deserialize(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key, deserialize]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // Save state
      setStoredValue(valueToStore);

      // Save to localStorage only after hydration
      if (typeof window !== "undefined" && isHydrated) {
        window.localStorage.setItem(key, serialize(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Listen for changes in other tabs/windows
  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserialize(e.newValue));
        } catch (error) {
          console.warn(
            `Error parsing localStorage change for key "${key}":`,
            error
          );
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, deserialize, isHydrated]);

  return [storedValue, setValue];
}

/**
 * Hook for managing boolean localStorage values
 */
export function useLocalStorageBoolean(key: string, initialValue: boolean) {
  return useLocalStorage(key, initialValue, {
    serialize: (value: boolean) => value.toString(),
    deserialize: (value: string) => value === "true"
  });
}

/**
 * Hook for managing string localStorage values
 */
export function useLocalStorageString(key: string, initialValue: string) {
  return useLocalStorage(key, initialValue);
}

/**
 * Hook for managing number localStorage values
 */
export function useLocalStorageNumber(key: string, initialValue: number) {
  return useLocalStorage(key, initialValue, {
    serialize: (value: number) => value.toString(),
    deserialize: (value: string) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? initialValue : parsed;
    }
  });
}

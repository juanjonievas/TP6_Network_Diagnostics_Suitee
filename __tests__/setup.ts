// Jest setup and native module mocks for headless testing in Node.js
import { Buffer } from 'buffer';
(global as any).Buffer = Buffer;

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (objs: any) => objs.android || objs.default,
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      CAMERA: 'android.permission.CAMERA',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn(() => Promise.resolve('granted')),
    check: jest.fn(() => Promise.resolve(true)),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  ActivityIndicator: 'ActivityIndicator',
  StatusBar: {
    setBarStyle: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
  },
}), { virtual: true });

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => {
  let listeners: Array<(state: any) => void> = [];
  let currentState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  };

  return {
    addEventListener: jest.fn((callback) => {
      listeners.push(callback);
      callback(currentState);
      return () => {
        listeners = listeners.filter(l => l !== callback);
      };
    }),
    fetch: jest.fn(() => Promise.resolve(currentState)),
    __setState: (newState: any) => {
      currentState = { ...currentState, ...newState };
      listeners.forEach(l => l(currentState));
    },
  };
});

// Mock Keychain
const inMemoryKeychain: Record<string, { username: string; password: string }> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SecureHardware',
    SECURE_SOFTWARE: 'SecureSoftware',
  },
  setGenericPassword: jest.fn(async (username, password, options = {}) => {
    const key = options.service || 'default';
    inMemoryKeychain[key] = { username, password };
    return { service: key };
  }),
  getGenericPassword: jest.fn(async (options = {}) => {
    const key = options.service || 'default';
    return inMemoryKeychain[key] || false;
  }),
  resetGenericPassword: jest.fn(async (options = {}) => {
    const key = options.service || 'default';
    delete inMemoryKeychain[key];
    return true;
  }),
  __clearAll: () => {
    Object.keys(inMemoryKeychain).forEach(k => delete inMemoryKeychain[k]);
  }
}));

// Mock Geolocation Service
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn((success) => {
    success({
      coords: {
        latitude: -32.4825,
        longitude: -58.2372,
        altitude: 12.5,
        accuracy: 5.0,
      },
      timestamp: Date.now(),
    });
  }),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
}));

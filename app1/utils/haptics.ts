import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptic = {
  // Light tap — for browsing interactions
  light: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('Haptic light failed', e);
    }
  },
  
  // Medium tap — for selections
  medium: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.warn('Haptic medium failed', e);
    }
  },
  
  // Success — for completed actions
  success: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn('Haptic success failed', e);
    }
  },
  
  // Error — for failed actions
  error: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      console.warn('Haptic error failed', e);
    }
  },
  
  // Selection change — for toggles
  selection: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      console.warn('Haptic selection failed', e);
    }
  }
};

export default haptic;

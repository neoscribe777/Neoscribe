import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EmojiSettings {
    speed: number;
    sway: number;
    size: number;
    density: number;
    enabled?: boolean;
    color?: string;
    isIcons?: boolean;
    imageUri?: string;
    isImage?: boolean;
}

interface EditorSettingsState {
  emojiTheme: string;
  emojiSettings: EmojiSettings;
  activeThemeId: string;
  language: string;
  loadSettings: () => Promise<void>;
  setActiveThemeId: (id: string) => Promise<void>;
  setEmojiTheme: (theme: string) => Promise<void>;
  setEmojiSettings: (settings: EmojiSettings) => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
}

export const useEditorSettings = create<EditorSettingsState>((set) => ({
  emojiTheme: '',
  emojiSettings: { speed: 3, sway: 2, size: 30, density: 40, enabled: true },
  activeThemeId: 'Pure Teal',

  loadSettings: async () => {
    try {
      const storedThemeId = await AsyncStorage.getItem('@settings_active_theme_id');
      if (storedThemeId) {
          set({ activeThemeId: storedThemeId });
      }
      
      const storedTheme = await AsyncStorage.getItem('@settings_emoji_theme');
      if (storedTheme) {
          set({ emojiTheme: storedTheme });
      }

      const storedSettings = await AsyncStorage.getItem('@settings_emoji_config');
      if (storedSettings) {
          try {
              set({ emojiSettings: JSON.parse(storedSettings) });
          } catch(_e) {}
      }

      const storedLang = await AsyncStorage.getItem('@settings_language');
      if (storedLang) {
          set({ language: storedLang });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  setActiveThemeId: async (id: string) => {
      set({ activeThemeId: id });
      try {
          await AsyncStorage.setItem('@settings_active_theme_id', id);
      } catch (_e) {
          console.error('Failed to save theme ID', _e);
      }
  },

  setEmojiTheme: async (theme: string) => {
      set({ emojiTheme: theme });
      try {
          await AsyncStorage.setItem('@settings_emoji_theme', theme);
      } catch (_e) {
          console.error('Failed to save theme', _e);
      }
  },

  setEmojiSettings: async (settings: EmojiSettings) => {
      set({ emojiSettings: settings });
      try {
          await AsyncStorage.setItem('@settings_emoji_config', JSON.stringify(settings));
      } catch (_e) {
          console.error('Failed to save emoji settings', _e);
      }
  },

  language: 'English',
  setLanguage: async (lang: string) => {
      set({ language: lang });
      try {
          await AsyncStorage.setItem('@settings_language', lang);
      } catch (_e) {
          console.error('Failed to save language', _e);
      }
  }
}));

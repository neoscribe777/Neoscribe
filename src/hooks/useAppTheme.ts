import { useEditorSettings } from '../store/useEditorSettings';
import { THEME_PRESETS, ThemeColors } from '../theme/themePresets';

/**
 * Custom hook to access application-wide theme and settings.
 */
export const useAppTheme = (): { 
  theme: ThemeColors; 
  themeId: string; 
  setThemeId: (id: string) => void;
  emojiTheme: string;
  emojiSettings: any;
  language: string;
  setLanguage: (lang: string) => void;
  loadSettings: () => Promise<void>;
} => {
  const { activeThemeId, setActiveThemeId, emojiTheme, emojiSettings, language, setLanguage, loadSettings } = useEditorSettings();

  const theme = THEME_PRESETS[activeThemeId] || THEME_PRESETS['Pure Teal'];

  return {
    theme,
    themeId: activeThemeId,
    setThemeId: setActiveThemeId,
    emojiTheme,
    emojiSettings,
    language,
    setLanguage,
    loadSettings,
  };
};


export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  primaryDark: string;
  text: string;
  textSecondary: string;
  divider: string;
  accent: string;
  favorite: string;
  card: string;
  isDark: boolean;
}

export const THEME_PRESETS: { [key: string]: ThemeColors } = {
  'Pure Teal': {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#008080',
    primaryDark: '#004D4D',
    text: '#212121',
    textSecondary: '#757575',
    divider: '#E0E0E0',
    accent: '#00CCCC',
    favorite: '#FFD700',
    card: '#FFFFFF',
    isDark: false,
  },
  'Paper Teal': {
    background: '#E0F2F1',
    surface: '#B2DFDB',
    primary: '#008080',
    primaryDark: '#004D4D',
    text: '#1B1B1B',
    textSecondary: '#666666',
    divider: '#80CBC4',
    accent: '#00CCCC',
    favorite: '#FBC02D',
    card: '#FFFFFF',
    isDark: false,
  },
  'Teal': {
    background: '#001A1A',
    surface: '#002626',
    primary: '#008080',
    primaryDark: '#004D4D',
    text: '#FFFFFF',
    textSecondary: '#B0C4DE',
    divider: '#003333',
    accent: '#00CCCC',
    favorite: '#FFD700',
    card: '#002626',
    isDark: true,
  },
  'Rainbow': {
    background: '#000000',
    surface: '#0A0A0A',
    primary: '#D946A6',
    primaryDark: '#A21C7A',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    divider: '#1A1A1A',
    accent: '#00B8D4',
    favorite: '#FFA726',
    card: '#0A0A0A',
    isDark: true,
  },
  'Paper': {
    background: '#FDFDFD',
    surface: '#F5F5F5',
    primary: '#3F51B5',
    primaryDark: '#303F9F',
    text: '#212121',
    textSecondary: '#757575',
    divider: '#E0E0E0',
    accent: '#448AFF',
    favorite: '#FFC107',
    card: '#FFFFFF',
    isDark: false,
  },
  'Forest': {
    background: '#1B1F1C',
    surface: '#242B26',
    primary: '#88B04B',
    primaryDark: '#4B5D43',
    text: '#E8EDEA',
    textSecondary: '#9AAB9F',
    divider: '#2D362F',
    accent: '#A3BE8C',
    favorite: '#D08770',
    card: '#242B26',
    isDark: true,
  },
  'Charcoal Ember': {
    background: '#121212',
    surface: '#1E1E1E',
    primary: '#FF5722',
    primaryDark: '#E64A19',
    text: '#E0E0E0',
    textSecondary: '#BDBDBD',
    divider: '#333333',
    accent: '#FF7043',
    favorite: '#FFC107',
    card: '#1E1E1E',
    isDark: true,
  },
};

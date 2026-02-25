import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Text } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface SoraNavigationBarProps {
  onSymbolPress: (symbol: string) => void;
}

const symbols = ['<', '>', '+', '-', '/', '*', '=', '(', ')', '{', '}', '[', ']', ';', ':', ',', '.', '"', "'", '?', '!', '@', '#', '$', '%', '^', '&', '_', '|', '\\', '`', '~'];

export const SoraNavigationBar: React.FC<SoraNavigationBarProps> = ({ onSymbolPress }) => {
  const { theme, themeId } = useAppTheme();
  const isRainbow = themeId === 'Rainbow';

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {symbols.map((symbol, index) => (
          <TouchableOpacity 
            key={index} 
            onPress={() => onSymbolPress(symbol)} 
            style={styles.symbolButton}
          >
            <Text style={[styles.symbolText, { color: isRainbow ? 'white' : theme.text }, isRainbow && styles.outlineEffect]}>{symbol}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderTopWidth: 1,
    elevation: 8,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  symbolButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  outlineEffect: {
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  }
});

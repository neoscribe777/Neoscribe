import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Text, 
  ScrollView 
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../hooks/useAppTheme';
import { RainbowBackground } from './RainbowBackground';

interface SoraSearchPanelProps {
  findText: string;
  replaceText: string;
  onFindTextChanged: (text: string) => void;
  onReplaceTextChanged: (text: string) => void;
  onMatchCaseChanged?: (matchCase: boolean) => void;
  matchCase?: boolean;
  onPreviousMatch: () => void;
  onNextMatch: () => void;
  onReplaceMatch: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  matchCount?: string;
}

// Replaced hardcoded ACCENT_COLOR with theme-based primary

export const SoraSearchPanel: React.FC<SoraSearchPanelProps> = ({
  findText,
  replaceText,
  onFindTextChanged,
  onReplaceTextChanged,
  onMatchCaseChanged,
  matchCase = false,
  onPreviousMatch,
  onNextMatch,
  onReplaceMatch,
  onReplaceAll,
  onClose,
  matchCount = "0/0"
}) => {
  const { theme, themeId } = useAppTheme();
  const [replaceMode, setReplaceMode] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      
      {/* Top Section: Toggle | Inputs | Close */}
      <View style={styles.topRow}>
        
        {/* Toggle Button (Left) */}
        <TouchableOpacity 
          style={styles.sideButton} 
          onPress={() => setReplaceMode(!replaceMode)}
        >
          <MaterialCommunityIcons 
            name={replaceMode ? "menu-up" : "menu-down"} 
            size={24} 
            color={theme.text} 
          />
        </TouchableOpacity>

        {/* Center Column: Inputs */}
        <View style={styles.centerColumn}>
          
          {/* Find Input */}
          <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Find"
              placeholderTextColor={theme.textSecondary}
              value={findText}
              onChangeText={onFindTextChanged}
              autoFocus
            />
            {matchCount && matchCount !== "0/0" && (
                <View style={[themeId === 'Rainbow' ? { backgroundColor: 'transparent', borderRadius: 4, overflow: 'hidden', paddingHorizontal: 4 } : {}]}>
                  {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
                  <Text style={[{ color: theme.text, fontSize: 12, marginRight: 8, opacity: 0.7 }, themeId === 'Rainbow' ? [styles.outlineEffect, { color: 'white' }] : {}]}>{matchCount}</Text>
                </View>
            )}
            <TouchableOpacity 
              onPress={() => onMatchCaseChanged?.(!matchCase)}
              style={themeId === 'Rainbow' && matchCase ? { backgroundColor: 'transparent', borderRadius: 4, overflow: 'hidden' } : {}}
            >
               {themeId === 'Rainbow' && matchCase && <RainbowBackground style={StyleSheet.absoluteFill} />}
               <MaterialCommunityIcons 
                name="dots-vertical" 
                size={22} 
                color={matchCase ? (themeId === 'Rainbow' ? 'white' : theme.primary) : theme.text} 
                style={themeId === 'Rainbow' && matchCase ? styles.outlineEffect : {}}
              />
            </TouchableOpacity>
          </View>

          {/* Replace Input (Conditional) */}
          {replaceMode && (
            <View style={[styles.inputContainer, { backgroundColor: theme.background, marginTop: 8 }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Replace"
                placeholderTextColor={theme.textSecondary}
                value={replaceText}
                onChangeText={onReplaceTextChanged}
              />
            </View>
          )}
        </View>

        {/* Close Button (Right) */}
        <TouchableOpacity style={styles.sideButton} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* spacer */}
      <View style={{ height: 8 }} />

      {/* Bottom Action Row */}
      <View style={styles.actionRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity 
            style={[styles.actionButton, themeId === 'Rainbow' ? styles.rainbowBtn : { backgroundColor: 'transparent' }]} 
            onPress={onPreviousMatch}
          >
            {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
            <Text style={[styles.actionButtonText, themeId === 'Rainbow' ? styles.outlineEffect : { color: theme.primary }]}>PREV</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, themeId === 'Rainbow' ? styles.rainbowBtn : { backgroundColor: 'transparent' }]} 
            onPress={onNextMatch}
          >
            {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
            <Text style={[styles.actionButtonText, themeId === 'Rainbow' ? styles.outlineEffect : { color: theme.primary }]}>NEXT</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { opacity: replaceMode ? 1 : 0.5 }, themeId === 'Rainbow' ? styles.rainbowBtn : { backgroundColor: 'transparent' }]} 
            onPress={onReplaceMatch}
            disabled={!replaceMode}
          >
            {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
            <Text style={[styles.actionButtonText, themeId === 'Rainbow' ? styles.outlineEffect : { color: theme.primary }]}>REPLACE</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { opacity: replaceMode ? 1 : 0.5 }, themeId === 'Rainbow' ? styles.rainbowBtn : { backgroundColor: 'transparent' }]} 
            onPress={onReplaceAll}
            disabled={!replaceMode}
          >
            {themeId === 'Rainbow' && <RainbowBackground style={StyleSheet.absoluteFill} />}
            <Text style={[styles.actionButtonText, themeId === 'Rainbow' ? styles.outlineEffect : { color: theme.primary }]}>REPLACE ALL</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align start because center column grows height
    paddingHorizontal: 4,
  },
  sideButton: {
    width: 40,
    height: 48, // Match input height roughly
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 0, 
  },
  centerColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    padding: 0,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rainbowBtn: {
    backgroundColor: 'transparent',
  },
  outlineEffect: {
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

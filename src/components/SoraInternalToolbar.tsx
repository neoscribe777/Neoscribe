import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform, StatusBar } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../hooks/useAppTheme';

interface SoraInternalToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onSearch: () => void;
  onBack: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  title?: string;
  onSave?: () => void;
  onShowMenu?: () => void;
}

export const SoraInternalToolbar: React.FC<SoraInternalToolbarProps> = ({
  onUndo,
  onRedo,
  onSearch,
  onBack,
  canUndo = true,
  canRedo = true,
  title = "Sora Editor",
  onSave,
  onShowMenu,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton}>
          <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity 
          onPress={onUndo} 
          disabled={!canUndo} 
          style={styles.iconButton}
        >
          <MaterialCommunityIcons 
            name="undo" 
            size={24} 
            color={canUndo ? theme.text : theme.textSecondary} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={onRedo} 
          disabled={!canRedo} 
          style={styles.iconButton}
        >
          <MaterialCommunityIcons 
            name="redo" 
            size={24} 
            color={canRedo ? theme.text : theme.textSecondary} 
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSearch} style={styles.iconButton}>
          <MaterialCommunityIcons name="magnify" size={24} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSave} style={styles.iconButton}>
          <MaterialCommunityIcons name="content-save-outline" size={24} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onShowMenu} style={styles.iconButton}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56 + (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0),
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    elevation: 4,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 4,
  },
});

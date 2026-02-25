import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  NativeModules,
  findNodeHandle,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

const { HandleColor } = NativeModules;

interface TextInputSelectionHandlesProps {
  inputRef: React.RefObject<any>;
  selection: { start: number; end: number } | null;
  onSelectionUpdate?: () => void;
}

export const TextInputSelectionHandles: React.FC<TextInputSelectionHandlesProps> = ({
  inputRef,
  selection,
}) => {
  const { theme } = useAppTheme();
  const [coords, setCoords] = useState<any>(null);

  const updateCoords = useCallback(async () => {
    if (!inputRef.current) return;
    const viewTag = findNodeHandle(inputRef.current);
    if (!viewTag) return;

    try {
      const result = await HandleColor.getSelectionCoordinates(viewTag);
      setCoords(result);
    } catch (e: any) {
      // Fail silently
    }
  }, [inputRef]);

  useEffect(() => {
    if (selection) {
      console.log('Selection updated:', selection);
      updateCoords();
    } else {
      console.log('Selection cleared');
      setCoords(null);
    }
  }, [selection, updateCoords]);

  useEffect(() => {
      console.log('Coords updated:', coords);
  }, [coords]);

  // Handle hiding native handles on mount
  useEffect(() => {
    if (inputRef.current) {
        const viewTag = findNodeHandle(inputRef.current);
        if (viewTag) {
            HandleColor.hideNativeHandles(viewTag);
        }
    }
  }, [inputRef]);

  if (!coords || coords.isCollapsed) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 100 }]} pointerEvents="none">
      {/* Left Handle */}
      <View
        style={[
          styles.handle,
          {
            backgroundColor: theme.primary,
            top: coords.startBottom + 4,
            left: coords.startX - 11,
            transform: [{ rotate: '45deg' }],
            borderTopLeftRadius: 0,
          },
        ]}
      />
      {/* Right Handle */}
      <View
        style={[
          styles.handle,
          {
            backgroundColor: theme.primary,
            top: coords.endBottom + 4,
            left: coords.endX - 11,
            transform: [{ rotate: '45deg' }],
            borderTopLeftRadius: 0,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    zIndex: 9999,
    elevation: 100, // Android z-index equivalent
  },
});

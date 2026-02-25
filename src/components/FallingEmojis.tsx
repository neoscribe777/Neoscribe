import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { EmojiSettings } from '../store/useEditorSettings';

// Safe dimensions fallback
const getDimensions = () => {
    const d = Dimensions.get('window');
    return {
        width: d.width || 400,
        height: d.height || 800
    };
};

interface FallingEmojiProps {
  emoji: string;
  index: number;
  settings: EmojiSettings;
  screenWidth: number;
  screenHeight: number;
}

const FallingEmoji = React.memo(({ emoji, index, settings, screenWidth, screenHeight }: FallingEmojiProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const swayValue = useRef(new Animated.Value(0)).current;

  // Safe settings with fallbacks to prevent NaN
  const safeDensity = Math.max(1, settings?.density || 1);
  const safeSize = settings?.size || 30;
  const safeSway = settings?.sway || 0;
  const safeSpeed = settings?.speed || 3;

  // Stable random seeds that never change for this particle instance
  const seeds = useMemo(() => {
    // Bucket-based distribution: Assign each index to a horizontal slice of the screen
    const bucketWidth = 1 / safeDensity;
    const bucketStart = index * bucketWidth;
    const randomInBucket = Math.random() * bucketWidth;
    
    return {
        x: bucketStart + randomInBucket,
        delay: Math.random() * 5000,
        duration: Math.random() * 2000,
        size: 0.8 + Math.random() * 0.4
    };
  }, [index, safeDensity]);

  const startX = seeds.x * screenWidth;
  const size = safeSize * seeds.size;
  const duration = Math.max(1000, (10000 - (safeSpeed * 1000)) + seeds.duration);

  useEffect(() => {
    if (!settings?.enabled) {
      animatedValue.setValue(0);
      return;
    }

    // Reset logic
    animatedValue.setValue(0);

    const fallAnimation = Animated.sequence([
        Animated.delay(seeds.delay),
        Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: duration,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        )
    ]);

    const swayDuration = 3000 + seeds.duration / 2; 

    const swayAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(swayValue, {
          toValue: 1,
          duration: swayDuration / 4,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
        Animated.timing(swayValue, {
          toValue: -1,
          duration: swayDuration / 2,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
        Animated.timing(swayValue, {
          toValue: 0,
          duration: swayDuration / 4,
          easing: Easing.sin,
          useNativeDriver: true,
        }),
      ])
    );

    fallAnimation.start();
    if (safeSway > 0) swayAnimation.start();

    return () => {
      fallAnimation.stop();
      swayAnimation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, animatedValue, swayValue, settings?.enabled, safeSway]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, screenHeight + 300],
  });

  const translateX = swayValue.interpolate({
    inputRange: [-1, 1],
    outputRange: [-safeSway * 30, safeSway * 30],
  });

  // Safe emoji string handling
  const emojiDisplay = (emoji || '').trim();

  return (
    <Animated.View
      style={[
        styles.emoji,
        {
          left: startX || 0,
          transform: [
              { translateY }, 
              { translateX },
              { translateX: -(size || 30) / 2 }
          ],
          opacity: 1, 
        },
      ]}
    >
      {settings?.isImage && settings?.imageUri && emoji === '_IMAGE_' ? (
          <Animated.Image 
            source={{ uri: settings.imageUri }} 
            style={{ width: size, height: size, borderRadius: 4 }} 
          />
      ) : settings?.isIcons && emoji !== '_IMAGE_' && /^[a-z0-9_-]+$/i.test(emojiDisplay) ? (
          <MaterialCommunityIcons 
            name={emojiDisplay} 
            size={size} 
            color={settings?.color || '#000000'} 
          />
      ) : (
          <Text style={{ fontSize: size, color: settings?.color || '#000000' }}>
            {emoji === '_IMAGE_' ? '🖼️' : emojiDisplay}
          </Text>
      )}
    </Animated.View>
  );
});

interface FallingEmojisProps {
  emojis: string;
  settings: EmojiSettings;
}

const FallingEmojis = React.memo(({ emojis, settings }: FallingEmojisProps) => {
  // Use stable dimensions check
  const { width: screenWidth, height: screenHeight } = getDimensions();

  const emojiArray = useMemo(() => {
    if (settings?.isImage && settings?.imageUri) {
        return ['_IMAGE_']; 
    }
    const safeEmojis = emojis || '';
    if (!safeEmojis) return [];
    if (settings?.isIcons) {
        return safeEmojis.split(',').filter(s => s.trim().length > 0);
    }
    return Array.from(safeEmojis);
  }, [emojis, settings?.isIcons, settings?.isImage, settings?.imageUri]);

  const particles = useMemo(() => {
    const density = Math.max(0, settings?.density || 0);
    if (emojiArray.length === 0 || density === 0) return [];
    
    return Array.from({ length: density }).map((_, i) => {
       const emoji = emojiArray[i % emojiArray.length];
       return (
         <FallingEmoji
            key={i} 
            index={i}
            emoji={emoji}
            settings={settings}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
         />
       );
    });
  }, [emojiArray, settings, screenWidth, screenHeight]);

  if (emojiArray.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles}
    </View>
  );
}, (prev, next) => {
    return (
        prev.emojis === next.emojis &&
        JSON.stringify(prev.settings) === JSON.stringify(next.settings)
    );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  emoji: {
    position: 'absolute',
    top: 0, 
  },
});

export default FallingEmojis;

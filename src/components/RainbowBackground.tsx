import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle, StyleProp } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface RainbowBackgroundProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  active?: boolean;
}

export const RainbowBackground: React.FC<RainbowBackgroundProps> = ({ style, children, active = true }) => {
  const RAINBOW_CYCLE = 600;
  const RAINBOW_REPEAT = 5;
  const RAINBOW_TOTAL_WIDTH = RAINBOW_CYCLE * RAINBOW_REPEAT;
  const baseColors = ['#E63946', '#F77F00', '#FCBF49', '#06D6A0', '#118AB2', '#073B4C', '#9D4EDD'];
  
  const rainbowColors = [];
  for (let i = 0; i < RAINBOW_REPEAT; i++) {
    rainbowColors.push(...baseColors);
  }
  rainbowColors.push(baseColors[0]);

  const rainbowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    
    if (active) {
      const startAnim = () => {
        rainbowAnim.setValue(0);
        animation = Animated.loop(
          Animated.timing(rainbowAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        animation.start();
      };

      // Slight delay to ensure layout is settled
      const timeout = setTimeout(startAnim, 50);
      return () => {
        clearTimeout(timeout);
        animation?.stop();
      };
    }
  }, [active, rainbowAnim]);

  const translateX = rainbowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -RAINBOW_CYCLE],
  });

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {active && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              width: RAINBOW_TOTAL_WIDTH,
              transform: [{ translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={rainbowColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {children}
    </View>
  );
};

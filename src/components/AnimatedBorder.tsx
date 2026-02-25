import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface AnimatedBorderProps {
  children: React.ReactNode;
  isActive: boolean;
  colors: string[];
  borderWidth?: number;
  borderRadius?: number;
  speed?: number;
}

export const AnimatedBorder: React.FC<AnimatedBorderProps> = ({
  children,
  isActive,
  colors,
  borderWidth = 5,
  borderRadius = 8,
  speed = 2000,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      const animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: speed,
          useNativeDriver: true,
        })
      );
      animation.start();
      return () => animation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isActive, rotateAnim, speed]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { borderRadius }]}>
      {/* Rotating gradient background (simulated with multiple colored views) */}
      <Animated.View
        style={[
          styles.gradientContainer,
          {
            transform: [{ rotate }],
            borderRadius: borderRadius * 2,
          },
        ]}
      >
        {colors.map((color, index) => (
          <View
            key={index}
            style={[
              styles.colorSegment,
              {
                backgroundColor: color,
                transform: [
                  { rotate: `${(360 / colors.length) * index}deg` },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>
      
      {/* Inner content with mask */}
      <View
        style={[
          styles.innerContent,
          {
            margin: borderWidth,
            borderRadius: borderRadius - borderWidth / 2,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  gradientContainer: {
    position: 'absolute',
    width: '250%',
    height: '250%',
    top: '-75%',
    left: '-75%',
  },
  colorSegment: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  innerContent: {
    backgroundColor: 'transparent',
    zIndex: 2,
  },
});

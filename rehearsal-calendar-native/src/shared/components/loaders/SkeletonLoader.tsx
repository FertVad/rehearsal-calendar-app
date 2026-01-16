import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { Colors } from '../../constants/colors';

export type SkeletonVariant = 'rectangular' | 'circular' | 'text';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * SkeletonLoader component for loading states
 * Provides animated shimmer effect for better perceived performance
 */
export default function SkeletonLoader({
  variant = 'rectangular',
  width = '100%',
  height = 20,
  borderRadius,
  style,
}: SkeletonLoaderProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'circular':
        const circleSize = typeof height === 'number' ? height : 40;
        return {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
        };
      case 'text':
        return {
          height: 16,
          borderRadius: 4,
        };
      case 'rectangular':
      default:
        return {
          borderRadius: borderRadius ?? 8,
        };
    }
  };

  return (
    <View style={[styles.container, { width, height }, getVariantStyle(), style]}>
      <Animated.View style={[styles.shimmer, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg.tertiary,
    overflow: 'hidden',
  },
  shimmer: {
    flex: 1,
    backgroundColor: Colors.glass.bgLight,
  },
});

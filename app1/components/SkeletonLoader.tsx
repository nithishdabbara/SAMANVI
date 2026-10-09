// app1/components/SkeletonLoader.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export const ShimmerPlaceholder = ({ width, height, style }: any) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.65],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          width: width || '100%',
          height: height || 20,
          backgroundColor: '#E2E8F0',
          opacity,
          borderRadius: style?.borderRadius || 8,
        },
      ]}
    />
  );
};

export const ProblemCardSkeleton = () => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ShimmerPlaceholder width={60} height={20} style={{ borderRadius: 10 }} />
        <ShimmerPlaceholder width={80} height={16} />
      </View>
      
      <ShimmerPlaceholder width="90%" height={24} style={{ marginVertical: 12, borderRadius: 6 }} />
      <ShimmerPlaceholder width="70%" height={16} style={{ marginBottom: 16 }} />
      
      <View style={styles.footer}>
        <ShimmerPlaceholder width={110} height={36} style={{ borderRadius: 18 }} />
        <View style={styles.footerMetrics}>
          <ShimmerPlaceholder width={40} height={16} />
          <ShimmerPlaceholder width={60} height={16} />
        </View>
      </View>
    </View>
  );
};

export const MessageRowSkeleton = () => {
  return (
    <View style={styles.messageRow}>
      <ShimmerPlaceholder width={56} height={56} style={{ borderRadius: 28 }} />
      <View style={styles.messageDetails}>
        <View style={styles.messageHeader}>
          <ShimmerPlaceholder width={100} height={16} style={{ borderRadius: 4 }} />
          <ShimmerPlaceholder width={40} height={12} style={{ borderRadius: 3 }} />
        </View>
        <ShimmerPlaceholder width="80%" height={14} style={{ marginTop: 8, borderRadius: 4 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(236, 238, 241, 0.5)',
    paddingTop: 16,
  },
  footerMetrics: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236, 238, 241, 0.5)',
  },
  messageDetails: {
    flex: 1,
    marginLeft: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

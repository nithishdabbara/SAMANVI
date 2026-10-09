import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';

const HEADER_MAX_HEIGHT = 120;
const HEADER_MIN_HEIGHT = 60;

interface LargeHeaderProps {
  title: string;
  subtitle: string;
  scrollY: SharedValue<number>;
}

export default function LargeHeader({ title, subtitle, scrollY }: LargeHeaderProps) {
  const titleAnimStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [1, 0.75],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [0, -26],
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [0, -10],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }, { translateY }, { translateX }]
    };
  });

  const subtitleAnimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 30],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 30],
      [0, -10],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }]
    };
  });

  return (
    <View style={styles.header}>
      <Animated.View style={[styles.titleContainer, titleAnimStyle]}>
        <Text style={styles.largeTitle}>
          {title}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.subtitleContainer, subtitleAnimStyle]}>
        <View style={styles.communityBadge}>
          <Text style={styles.communityIcon}>📍</Text>
          <Text style={styles.communityName}>{subtitle}</Text>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: HEADER_MAX_HEIGHT,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  titleContainer: {
    alignSelf: 'flex-start',
  },
  largeTitle: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitleContainer: {
    marginTop: 6,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  communityIcon: {
    fontSize: 12,
  },
  communityName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  lockIcon: {
    fontSize: 10,
  },
});

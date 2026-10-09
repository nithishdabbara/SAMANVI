import React from 'react';
import Animated, { 
  FadeInRight, 
  FadeOutLeft, 
  FadeInDown,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { springConfig } from '../constants/animations';
import { haptic } from '../utils/haptics';

export function ScreenTransition({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View 
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(250)}
      style={{ flex: 1 }}
    >
      {children}
    </Animated.View>
  );
}

export function ListItemTransition({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(350)}
      layout={LinearTransition.springify().damping(15)}
    >
      {children}
    </Animated.View>
  );
}

interface SpringButtonProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  hapticType?: 'light' | 'medium' | 'success' | 'error';
}

export function SpringButton({ style, children, hapticType = 'light', onPress, ...props }: SpringButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = (e: any) => {
    if (hapticType) {
      haptic[hapticType]();
    }
    if (onPress) {
      onPress(e);
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

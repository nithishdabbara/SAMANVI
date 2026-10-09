import { 
  withSpring, 
  withTiming,
  Easing 
} from 'react-native-reanimated';

export const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.8
};

export const iosSpring = (value: number) => 
  withSpring(value, springConfig);

export const iosTiming = (value: number) => 
  withTiming(value, {
    duration: 250,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
  });

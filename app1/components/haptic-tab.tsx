import { Pressable, PressableProps } from 'react-native';
import { haptic } from '../utils/haptics';

export function HapticTab(props: PressableProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        haptic.light();
        props.onPressIn?.(ev);
      }}
    />
  );
}

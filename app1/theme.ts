import { useColorScheme } from 'react-native';

export const palette = {
  blue: '#0A84FF', indigo: '#5E5CE6', green: '#30D158', orange: '#FF9F0A',
  red: '#FF453A', pink: '#FF375F', purple: '#BF5AF2', teal: '#30B0C7',
};
const light = { bg: '#F2F2F7', card: '#FFFFFF', fill: '#F2F3F7', text: '#111827', mute: '#6B7280', line: '#E5E7EB' };
const dark = { bg: '#000000', card: '#1C1C1E', fill: '#2C2C2E', text: '#F5F5F7', mute: '#9A9AA3', line: '#38383A' };

export const radius = { sm: 12, md: 16, lg: 22, xl: 28 };

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { isDark, ...(isDark ? dark : light), ...palette };
}
export type Theme = ReturnType<typeof useTheme>;

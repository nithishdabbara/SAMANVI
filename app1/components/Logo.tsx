import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';

/** Samanvi mark: a location pin (hyperlocal 1 km) holding two linked people and a smile-check. */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#40A9FF" />
          <Stop offset="0.55" stopColor="#0A84FF" />
          <Stop offset="1" stopColor="#5E5CE6" />
        </LinearGradient>
        <LinearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="120" height="120" rx="27" fill="url(#lg)" />
      <Rect width="120" height="62" rx="27" fill="url(#gl)" />
      <Path d="M60 98S32 76 32 52a28 28 0 0 1 56 0c0 24-28 46-28 46z" fill="#FFFFFF" />
      <Circle cx="50" cy="48" r="6.5" fill="#0A84FF" />
      <Circle cx="70" cy="48" r="6.5" fill="#5E5CE6" />
      <Path d="M48 66q12 9 24 0" stroke="#0A84FF" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Animated,
  TextInputProps, ViewStyle, StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, radius } from '../theme';

export const TAB_KEYS = ['home', 'feed', 'post', 'inbox', 'profile'];

/** Navigate by screen key. Tab keys open the tab bar; 'back' goes back. */
export function useGo() {
  const router = useRouter();
  return (key?: string) => {
    if (!key) return;
    if (key === 'back') {
      if (router.canGoBack()) return router.back();
      return router.push('/');
    }
    
    // Map registry keys to Expo paths
    const routes: Record<string, any> = {
      splash: '/',
      welcome: '/',
      login: '/login',
      rphone: '/register',
      rotp: '/register/verify',
      raad: '/register/aadhaar',
      raotp: '/register/aadhaar-verify',
      rlock: '/register/lock-area',
      home: '/(tabs)',
      feed: '/(tabs)/feed',
      post: '/post',
      inbox: '/(tabs)/inbox',
      profile: '/(tabs)/profile'
    };
    
    const path = routes[key];
    if (path) router.push(path);
    else router.push(('/' + key) as any);
  };
}

export function Screen({ children, scroll = true, tabs = false, bg, pad = 20 }: {
  children: React.ReactNode; scroll?: boolean; tabs?: boolean; bg?: string; pad?: number;
}) {
  const t = useTheme();
  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: pad, paddingBottom: tabs ? 120 : 48 }}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: pad }}>{children}</View>
  );
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: bg ?? t.card }}>{inner}</SafeAreaView>;
}

export function Header({ title, back = 'back', right }: { title?: string; back?: string | null; right?: React.ReactNode }) {
  const go = useGo();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 36 }}>
      {back !== null && (
        <Pressable onPress={() => go(back)} hitSlop={14} style={{ marginRight: 6 }}>
          <Ionicons name="chevron-back" size={28} color={t.blue} />
        </Pressable>
      )}
      <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: t.text }}>{title}</Text>
      {right}
    </View>
  );
}

export const H1 = ({ children, center, size = 26 }: { children: React.ReactNode; center?: boolean; size?: number }) => {
  const t = useTheme();
  return <Text style={{ fontSize: size, fontWeight: '800', letterSpacing: -0.6, color: t.text, textAlign: center ? 'center' : 'left', marginTop: 6 }}>{children}</Text>;
};
export const Sub = ({ children, center, style }: { children: React.ReactNode; center?: boolean; style?: any }) => {
  const t = useTheme();
  return <Text style={[{ fontSize: 13.5, lineHeight: 19, color: t.mute, textAlign: center ? 'center' : 'left', marginTop: 4 }, style]}>{children}</Text>;
};
export const Label = ({ children }: { children: React.ReactNode }) => {
  const t = useTheme();
  return <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, color: t.mute, marginTop: 14, marginBottom: 6 }}>{children}</Text>;
};

type Kind = 'primary' | 'ghost' | 'outline' | 'danger' | 'whatsapp';
export function Button({ title, onPress, kind = 'primary', icon, disabled, style }: {
  title: string; onPress?: () => void; kind?: Kind; icon?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const grad = kind === 'primary' ? [t.blue, t.indigo] : kind === 'danger' ? [t.red, t.pink] : null;
  const fg = grad || kind === 'whatsapp' ? '#fff' : kind === 'outline' ? t.blue : t.text;
  const body = (
    <>
      {icon ? <Ionicons name={icon as any} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>
    </>
  );
  const base: ViewStyle = { height: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' };
  const shadow: ViewStyle = grad ? { shadowColor: grad[0], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 } : {};
  return (
    <Animated.View style={[{ transform: [{ scale: s }], opacity: disabled ? 0.45 : 1 }, style]}>
      <Pressable disabled={disabled} onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)}>
        {grad ? (
          <LinearGradient colors={grad as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[base, shadow]}>{body}</LinearGradient>
        ) : (
          <View style={[base, kind === 'whatsapp' && { backgroundColor: '#25D366' }, kind === 'ghost' && { backgroundColor: t.fill },
            kind === 'outline' && { borderWidth: 1.5, borderColor: t.blue }]}>{body}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function Field({ label, icon, prefix, style, secureTextEntry, ...p }: { label?: string; icon?: string; prefix?: string; secureTextEntry?: boolean } & TextInputProps) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  const isPassword = secureTextEntry !== undefined;
  
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.fill, borderRadius: radius.md, height: 54, paddingHorizontal: 14 }}>
        {icon ? <Ionicons name={icon as any} size={19} color={t.mute} style={{ marginRight: 10 }} /> : null}
        {prefix ? <Text style={{ color: t.text, fontWeight: '700', marginRight: 8 }}>{prefix}</Text> : null}
        <TextInput 
          placeholderTextColor={t.mute} 
          secureTextEntry={isPassword ? !show : false}
          style={[{ flex: 1, fontSize: 16, color: t.text, height: '100%' }, style]} 
          {...p} 
        />
        {isPassword ? (
          <Pressable onPress={() => setShow(!show)} style={{ padding: 4 }}>
            <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={20} color={t.mute} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Avatar({ name, size = 44, colors = ['#64D2FF', '#0A84FF'] }: { name: string; size?: number; colors?: [string, string] }) {
  return (
    <LinearGradient colors={colors} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name[0]}</Text>
    </LinearGradient>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '24', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 11.5, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Chip({ text, on, onPress, color }: { text: string; on?: boolean; onPress?: () => void; color?: string }) {
  const t = useTheme();
  const c = color ?? t.blue;
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: on ? c : t.fill, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: on ? '#fff' : t.text, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
}

export function Seg({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.fill, borderRadius: 11, padding: 3, marginVertical: 10 }}>
      {items.map((x, i) => (
        <Pressable key={x} onPress={() => onChange(i)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: i === index ? t.card : 'transparent' }}>
          <Text style={{ fontWeight: '600', fontSize: 13, color: t.text }}>{x}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ icon, emoji, color, title, sub, right, onPress, leading }: {
  icon?: string; emoji?: string; color?: string; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; leading?: React.ReactNode;
}) {
  const t = useTheme();
  const c = color ?? t.blue;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.fill, borderRadius: radius.md, padding: 12, marginVertical: 5 }}>
        {leading ?? (icon || emoji ? (
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            {emoji ? <Text style={{ fontSize: 20 }}>{emoji}</Text> : <Ionicons name={icon as any} size={21} color={c} />}
          </View>
        ) : null)}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{title}</Text>
          {sub ? <Text style={{ color: t.mute, fontSize: 12.5, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={t.mute} /> : null)}
      </View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: radius.lg, padding: 14, marginVertical: 8,
      shadowColor: '#000', shadowOpacity: t.isDark ? 0 : 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
      borderWidth: t.isDark ? 1 : 0, borderColor: t.line }, style]}>{children}</View>
  );
}

export function Hero({ children, colors = ['#0A84FF', '#5E5CE6'], style }: { children: React.ReactNode; colors?: string[]; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 24, padding: 20, marginVertical: 10, shadowColor: colors[0], shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 }, style]}>
      {children}
    </LinearGradient>
  );
}

/** Fade + rise entrance used for staggered cards. */
export function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 600, delay, useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

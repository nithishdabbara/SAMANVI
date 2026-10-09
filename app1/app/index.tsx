import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { FadeUp } from '../components/ui';
/* ───────────── 01 Splash & Welcome combined ───────────── */
const FEATURES: [string, string, string, string][] = [
  ['location', 'Locked to 1km', 'Only your real neighbors can see and respond to posts.', '#30D158'],
  ['people', 'Free & Paid Help', 'Volunteer freely, refer someone, or find skilled help nearby.', '#0A84FF'],
  ['shield-checkmark', 'Aadhaar Verified', 'Every neighbor is identity-verified. Real people, real trust.', '#BF5AF2'],
  ['heart', 'Make Friends', 'Every help becomes a connection. Build your neighborhood network.', '#FF375F'],
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Splash Animations
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const pop = useRef(new Animated.Value(0)).current;
  const flt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start splash rings
    rings.forEach((r, i) => {
      setTimeout(() => {
        Animated.loop(Animated.timing(r, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
      }, i * 1050);
    });
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(flt, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flt, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Hide splash after 2.8 seconds
    const id = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(id);
  }, []);

  if (showSplash) {
    return (
      <LinearGradient colors={['#0A5BD6', '#06388F', '#031F5C']} style={styles.splashBg}>
        {rings.map((r, i) => (
          <Animated.View key={i} style={[
            styles.ring,
            { opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }) },
            { transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] }) }] }
          ]} />
        ))}
        <Animated.View style={[
          styles.logoBox,
          { transform: [{ scale: pop }, { translateY: flt.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }
        ]}>
          <Ionicons name="people" size={58} color="#0A84FF" />
        </Animated.View>
        <Text style={styles.splashTitle}>Samanvi</Text>
        <Text style={styles.splashTag}>● TRUSTED NEIGHBORHOOD NETWORK</Text>
        <Text style={styles.splashSub}>Verified & Locked within 1km</Text>
        <ActivityIndicator color="#fff" style={{ position: 'absolute', bottom: 80 }} />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <LinearGradient colors={['rgba(10, 132, 255, 0.2)', 'transparent']} style={styles.topGradient} />
      
      <View style={{ flex: 1, padding: 20 }}>
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <FadeUp>
            <View style={styles.welcomeLogoWrap}>
              <Logo size={66} />
            </View>
          </FadeUp>
          <Text style={styles.welcomeTitle}>Samanvi</Text>
          <Text style={styles.welcomeSub}>A trusted circle of neighbors, verified and within 1km of your home.</Text>
        </View>

        <View style={styles.grid}>
          {FEATURES.map(([ic, title, desc, c], i) => (
            <View key={title} style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: c + '1C' }]}>
                <Ionicons name={ic as any} size={20} color={c} />
              </View>
              <Text style={[styles.cardTitle, { color: c }]}>{title}</Text>
              <Text style={styles.cardDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <BlurView intensity={80} tint="light" style={styles.bottomBar}>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/register')}>
          <LinearGradient colors={['#0A84FF', '#5E5CE6']} style={styles.primaryBtnGrad}>
            <Text style={styles.primaryBtnText}>Join My Community</Text>
          </LinearGradient>
        </Pressable>
        
        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/login')}>
          <Text style={styles.secondaryBtnText}>I already have an account</Text>
        </Pressable>
        <Text style={styles.termsText}>By continuing you agree to our community trust guidelines.</Text>
      </BlurView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: '#ffffff44' },
  logoBox: { width: 112, height: 112, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0A84FF', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 16 },
  splashTitle: { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 30 },
  splashTag: { color: '#9CC9FF', fontSize: 10, fontWeight: '700', letterSpacing: 2.4, marginTop: 8 },
  splashSub: { color: '#ffffffbb', fontSize: 13, marginTop: 6 },
  
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  welcomeLogoWrap: { padding: 8, borderRadius: 26, backgroundColor: 'rgba(10,132,255,0.1)' },
  welcomeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: '#0F172A', marginTop: 12 },
  welcomeSub: { fontSize: 14, color: '#64748B', textAlign: 'center', maxWidth: 270, marginTop: 8 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 30 },
  card: { width: '48%', marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, minHeight: 140, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', marginTop: 10 },
  cardDesc: { color: '#64748B', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 34 },
  primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#0A84FF', shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  primaryBtnGrad: { height: 56, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 56, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '600' },
  termsText: { color: '#64748B', fontSize: 10.5, textAlign: 'center', marginTop: 12 }
});
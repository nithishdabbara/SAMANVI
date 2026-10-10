import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, ActivityIndicator, Pressable, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
import { Logo } from '../components/Logo';
import { Dialog } from '../components/Dialog';
import * as Location from 'expo-location';
import { Screen, Header, H1, Sub, Button, Field, FadeUp, useGo } from '../components/ui';
import { useTheme } from '../theme';

const toMain = (nav?: any) => router.replace('/(tabs)');

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ 01 Splash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export function Splash() {
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const pop = useRef(new Animated.Value(0)).current;
  const flt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rings.forEach((r, i) => {
      setTimeout(() => Animated.loop(Animated.timing(r, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true })).start(), i * 1050);
    });
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(flt, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flt, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    const id = setTimeout(() => router.replace('/'), 2800);
    return () => clearTimeout(id);
  }, []);

  return (
    <Pressable style={{ flex: 1 }} onPress={() => router.replace('/')}>
      <LinearGradient colors={['#0A5BD6', '#06388F', '#031F5C']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {rings.map((r, i) => (
          <Animated.View key={i} style={{
            position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: '#ffffff44',
            opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] }) }],
          }} />
        ))}
        <Animated.View style={{
          width: 112, height: 112, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#0A84FF', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 16,
          transform: [{ scale: pop }, { translateY: flt.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
        }}>
          <Ionicons name="people" size={58} color="#0A84FF" />
        </Animated.View>
        <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1, marginTop: 30 }}>Samanvi</Text>
        <Text style={{ color: '#9CC9FF', fontSize: 10, fontWeight: '700', letterSpacing: 2.4, marginTop: 8 }}>â— TRUSTED NEIGHBORHOOD NETWORK</Text>
        <Text style={{ color: '#ffffffbb', fontSize: 13, marginTop: 6 }}>Verified & Locked within 1km</Text>
        <ActivityIndicator color="#fff" style={{ position: 'absolute', bottom: 80 }} />
      </LinearGradient>
    </Pressable>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ 02 Welcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const FEATURES: [string, string, string, string][] = [
  ['location', 'Locked to 1km', 'Only your real neighbors can see and respond to posts.', '#30D158'],
  ['people', 'Free & Paid Help', 'Volunteer freely, refer someone, or find skilled help nearby.', '#0A84FF'],
  ['shield-checkmark', 'Aadhaar Verified', 'Every neighbor is identity-verified. Real people, real trust.', '#BF5AF2'],
  ['heart', 'Make Friends', 'Every help becomes a connection. Build your neighborhood network.', '#FF375F'],
];
export function Welcome() {
  const t = useTheme();
  const go = useGo();
  return (
    <View style={{ flex: 1, backgroundColor: t.card }}>
      <LinearGradient colors={[t.blue + '30', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260 }} />
      <Screen bg="transparent">
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <FadeUp><View style={{ padding: 8, borderRadius: 26, backgroundColor: t.blue + '1C' }}><Logo size={66} /></View></FadeUp>
          <H1 center size={32}>Samanvi</H1>
          <Sub center style={{ maxWidth: 270 }}>A trusted circle of neighbors, verified and within 1km of your home.</Sub>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 24, paddingBottom: 150 }}>
          {FEATURES.map(([ic, title, desc, c], i) => (
            <FadeUp key={title} delay={150 + i * 120} style={{ width: '48%', marginBottom: 12 }}>
              <View style={{ backgroundColor: c + '1C', borderRadius: 22, padding: 14, minHeight: 150 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#ffffffaa', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={ic as any} size={20} color={c} />
                </View>
                <Text style={{ color: c, fontSize: 14, fontWeight: '800', marginTop: 10 }}>{title}</Text>
                <Text style={{ color: t.mute, fontSize: 11.5, lineHeight: 16, marginTop: 4 }}>{desc}</Text>
              </View>
            </FadeUp>
          ))}
        </View>
      </Screen>
      <BlurView intensity={50} tint={t.isDark ? 'dark' : 'light'} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 34 }}>
        <Button title="Join My Community" onPress={() => go('rphone')} />
        <Button title="I already have an account" kind="ghost" onPress={() => go('login')} style={{ marginTop: 10 }} />
        <Text style={{ color: t.mute, fontSize: 10.5, textAlign: 'center', marginTop: 10 }}>By continuing you agree to our community trust guidelines.</Text>
      </BlurView>
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ 03 Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export function Login() {
  const t = useTheme();
  const go = useGo();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const ok = email.includes('@') && pw.length >= 6;

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
        body: JSON.stringify({ email, password: pw })
      });
      const data = await res.json();
      if (res.ok) {
        await SecureStore.setItemAsync('userToken', data.token);
        await SecureStore.setItemAsync('userName', data.user?.full_name || data.user?.name || '');
        if (data.user?.id) await SecureStore.setItemAsync('userId', String(data.user.id));
        toMain();
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
    } catch (e) {
      Alert.alert('Network Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header back="welcome" title="" />
      <View style={{ alignItems: 'center' }}>
        <Logo size={64} />
        <H1 center>Welcome to Samanvi</H1>
        <Sub center>Your gateway to civic engagement and community coordination.</Sub>
      </View>
      <View style={{ marginTop: 18 }}>
        <Field label="EMAIL ADDRESS" icon="mail-outline" placeholder="hello@samanvi.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="PASSWORD" icon="lock-closed-outline" placeholder="Enter secure password" secureTextEntry value={pw} onChangeText={setPw} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Switch value={remember} onValueChange={setRemember} trackColor={{ true: t.green }} />
            <Text style={{ color: t.mute, marginLeft: 8, fontSize: 13 }}>Remember me</Text>
          </View>
          <Text style={{ color: t.blue, fontWeight: '600', fontSize: 13 }}>Forgot Password?</Text>
        </View>
        <Button title={loading ? "Logging in..." : "Secure Login"} icon="shield-checkmark" disabled={!ok || loading} onPress={handleLogin} />
        <Text style={{ color: t.mute, textAlign: 'center', marginTop: 16 }}>
          Don't have an account? <Text style={{ color: t.blue, fontWeight: '700' }} onPress={() => go('rphone')}>Register Now</Text>
        </Text>
      </View>
    </Screen>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Registration (5 steps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Steps({ n }: { n: number }) {
  const t = useTheme();
  const anim = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    anim.forEach((a, i) => Animated.timing(a, { toValue: i < n ? 1 : 0, duration: 600, delay: i * 80, useNativeDriver: false }).start());
  }, [n]);
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 14 }}>
      {anim.map((a, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: t.fill, overflow: 'hidden' }}>
          <Animated.View style={{ height: 4, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
            <LinearGradient colors={[t.blue, t.indigo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      ))}
    </View>
  );
}
function RegShell({ step, title, sub, back, children }: { step: number; title: string; sub: string; back: string; children: React.ReactNode }) {
  const t = useTheme();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, []);
  return (
    <Screen>
      <Header back={back} title="" />
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale: pop }], width: 56, height: 56, borderRadius: 18, backgroundColor: t.blue + '1C', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={28} color={t.blue} />
        </Animated.View>
        <H1 center>{title}</H1>
        <Sub center style={{ maxWidth: 290 }}>{sub}</Sub>
      </View>
      <Steps n={step} />
      {children}
    </Screen>
  );
}
const digits = (s: string, n: number) => s.replace(/\D/g, '').slice(0, n);

const regState = {
  phone: '',
  name: '',
  aadhaar: '',
  email: '',
  password: '',
  aadhaar_verification_token: ''
};

export function RegPhone() {
  const go = useGo();
  const t = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const ok = phone.length === 10;

  const handleSendOtp = async (channel: 'sms' | 'whatsapp' = 'sms') => {
    setLoading(true);
    try {
      const endpoint = channel === 'whatsapp' ? '/auth/send-whatsapp-otp' : '/auth/send-phone-otp';
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + phone })
      });
      const data = await res.json();
      if (res.ok) {
        regState.phone = phone;
        Alert.alert('Development OTP', 'Please enter ' + (data.dev_otp || '123456') + ' to verify.', [{ text: 'OK', onPress: () => go('rotp') }]);
      } else {
        if (data.code === 'sms_disabled' || res.status === 501) {
          regState.phone = phone;
          Alert.alert('Development OTP', 'Please enter ' + (data.dev_otp || '123456') + ' to verify.', [{ text: 'OK', onPress: () => go('rotp') }]);
        } else {
          Alert.alert('Could Not Send Code', data.error || 'Please check your phone number.');
        }
      }
    } catch {
      regState.phone = phone;
      Alert.alert('Development OTP', 'Please enter 123456 to verify.', [{ text: 'OK', onPress: () => go('rotp') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegShell step={1} back="welcome" title="Phone OTP Verification" sub="Enter your mobile number to receive your login code.">
      <Field label="MOBILE NUMBER" prefix="+91" placeholder="Enter 10-digit number" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(v) => { const val = digits(v, 10); setPhone(val); regState.phone = val; }} />
      <Sub style={{ fontSize: 11 }}>Your number is stored securely and never shown to others.</Sub>
      <Button title={loading ? "Sending Code..." : "Send Verification Code"} disabled={!ok || loading} onPress={() => handleSendOtp('sms')} style={{ marginTop: 22 }} />
      <Button title="Get OTP via WhatsApp" kind="whatsapp" icon="logo-whatsapp" disabled={!ok || loading} onPress={() => handleSendOtp('whatsapp')} style={{ marginTop: 10 }} />
      <Text style={{ color: t.mute, textAlign: 'center', marginTop: 18 }}>
        Already have an account? <Text style={{ color: t.blue, fontWeight: '700' }} onPress={() => go('login')}>Login Here</Text>
      </Text>
    </RegShell>
  );
}

export function RegOtp() {
  const go = useGo();
  const t = useTheme();
  const [otp, setOtp] = useState('');
  const [left, setLeft] = useState(60);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + regState.phone, otp, purpose: 'register' })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        go('raad');
      } else {
        Alert.alert('Verification Failed', data.error || 'The code you entered is incorrect or expired.');
      }
    } catch {
      Alert.alert('Network Error', 'Could not connect to verification service.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/send-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + regState.phone })
      });
      setLeft(60);
      setOtp('');
      Alert.alert('Code Dispatched', 'A new verification code has been requested.');
    } catch {
      Alert.alert('Error', 'Could not request a new code.');
    }
  };

  return (
    <RegShell step={2} back="rphone" title="Phone OTP Verification" sub="Please enter the verification code sent to your device.">
      <Field label="ENTER 6-DIGIT OTP" icon="key-outline" placeholder="6-digit code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(v) => setOtp(digits(v, 6))} style={{ letterSpacing: 6, fontWeight: '600' }} />
      <Button title={verifying ? "Verifying..." : "Verify & Continue"} disabled={otp.length !== 6 || verifying} onPress={handleVerify} style={{ marginTop: 22 }} />
      <Text style={{ color: t.mute, textAlign: 'center', marginTop: 16 }}>
        {left > 0 ? <>Resend OTP in <Text style={{ color: t.blue, fontWeight: '700' }}>{left}</Text>s</> : <Text style={{ color: t.blue, fontWeight: '700' }} onPress={handleResend}>Resend OTP</Text>}
      </Text>
    </RegShell>
  );
}

export function RegAadhaar() {
  const go = useGo();
  const [name, setName] = useState('');
  const [aad, setAad] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const ok = name.trim().length > 1 && aad.length === 12 && email.includes('@') && pw.length >= 6;
  const spaced = aad.replace(/(\d{4})(?=\d)/g, '$1 ');

  const handleSendAadhaar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-aadhaar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar: aad, phone: regState.phone })
      });
      const data = await res.json();
      if (res.ok || res.status === 502 || res.status === 503) {
        regState.name = name;
        regState.aadhaar = aad;
        regState.email = email;
        regState.password = pw;
        Alert.alert('Development OTP', 'Please enter ' + (data.dev_otp || '123456') + ' to verify Aadhaar.', [{ text: 'OK', onPress: () => go('raotp') }]);
      } else {
        Alert.alert('Aadhaar Failed', data.error || 'Could not verify Aadhaar number.');
      }
    } catch (e: any) {
      regState.name = name;
      regState.aadhaar = aad;
      regState.email = email;
      regState.password = pw;
      Alert.alert('Development OTP', 'Please enter 123456 to verify Aadhaar.', [{ text: 'OK', onPress: () => go('raotp') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegShell step={3} back="rotp" title="Aadhaar Identity Lock" sub="Validate your credentials and full identity using Aadhaar.">
      <Field label="FULL NAME (AS ON AADHAAR)" icon="person-outline" placeholder="e.g. Nithish Kumar" maxLength={50} value={name} onChangeText={setName} />
      <Field label="AADHAAR NUMBER (12-DIGITS)" icon="card-outline" placeholder="e.g. 3674 8291 6916" keyboardType="number-pad" maxLength={14} value={spaced} onChangeText={(v) => { const val = digits(v, 12); setAad(val); }} />
      <Field label="EMAIL ADDRESS (FOR UPDATES)" icon="mail-outline" placeholder="e.g. nithish@gmail.com" autoCapitalize="none" keyboardType="email-address" maxLength={100} value={email} onChangeText={setEmail} />
      <Field label="SECURE PASSWORD" icon="lock-closed-outline" placeholder="Enter password (6+ chars)" secureTextEntry value={pw} onChangeText={setPw} />
      <Button title={loading ? "Sending..." : "Verify Identity"} disabled={!ok || loading} onPress={handleSendAadhaar} style={{ marginTop: 20 }} />
      <Sub center style={{ fontSize: 11, marginTop: 10 }}>Aadhaar is stored only as a SHA-256 hash + last 4 digits.</Sub>
    </RegShell>
  );
}

export function RegAadhaarOtp() {
  const go = useGo();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyAadhaar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-aadhaar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadhaar: regState.aadhaar,
          otp: otp,
          phone: regState.phone,
          name: regState.name
        })
      });
      const data = await res.json();
      if (res.ok && data.aadhaar_verification_token) {
        regState.aadhaar_verification_token = data.aadhaar_verification_token;
        regState.name = data.full_name || regState.name;
        go('rlock');
      } else {
        Alert.alert('Verification Failed', data.error || 'Incorrect OTP.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RegShell step={4} back="raad" title="Aadhaar Identity Lock" sub="Verify the 6-digit passcode sent for Aadhaar identity.">
      <Field label="ENTER 6-DIGIT AADHAAR OTP" icon="shield-checkmark-outline" placeholder="6-digit code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(v) => setOtp(digits(v, 6))} style={{ letterSpacing: 6, fontWeight: '600' }} />
      <Button title={loading ? "Verifying..." : "Verify Aadhaar Identity"} disabled={otp.length !== 6 || loading} onPress={handleVerifyAadhaar} style={{ marginTop: 22 }} />
    </RegShell>
  );
}

export function RegLock() {
  const t = useTheme();
  const [ok, setOk] = useState(false);
  const [done, setDone] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({ latitude: 22.294884, longitude: 73.362334 });
  const [address, setAddress] = useState('Current Community Location');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setAddress(`Current GPS Location (${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)})`);
        }
      } catch {}
    })();
  }, []);

  return (
    <RegShell step={5} back="raotp" title="Lock Neighborhood" sub="Permanently set your home coordinate boundary to 1km.">
      <View style={{ backgroundColor: t.fill, borderRadius: 26, padding: 18, alignItems: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: t.green + '1C', borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.green + '66', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: t.green, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={38} color="#fff" />
          </View>
        </View>
        <Text style={{ color: t.green, fontWeight: '800', fontSize: 17, marginVertical: 10 }}>Lock Your Neighborhood</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderRadius: 14, padding: 12, alignSelf: 'stretch' }}>
          <Ionicons name="location" size={18} color={t.blue} />
          <Text style={{ color: t.text, marginLeft: 8, fontSize: 13 }}>{address}</Text>
        </View>
        <Text style={{ color: t.mute, fontSize: 11, marginTop: 10 }}>GPS: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</Text>
      </View>
      <Text style={{ color: t.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 14 }}>📍 Hyperlocal Community lock active</Text>
      <Sub center style={{ fontSize: 11.5 }}>Your account is locked to a 1km radius from this home coordinate. You will only see and interact with neighbors within this 1km boundary.</Sub>
      <Pressable onPress={() => setOk(!ok)} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: ok ? t.blue : t.line, backgroundColor: ok ? t.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {ok ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
        </View>
        <Text style={{ color: t.text, fontSize: 12.5, marginLeft: 10, flex: 1 }}>I confirm this is my resident location and lock it to Samanvi.</Text>
      </Pressable>
      <Button title="Lock & Join Samanvi" disabled={!ok} onPress={async () => {
          try {
            const res = await fetch(API_BASE_URL + "/auth/register", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
              body: JSON.stringify({
                email: regState.email,
                password: regState.password,
                name: regState.name,
                phone: regState.phone,
                aadhaar_token: regState.aadhaar_verification_token,
                latitude: coords.latitude,
                longitude: coords.longitude
              })
            });
            const data = await res.json();
            if (res.ok) {
              setDone(true);
            } else {
              Alert.alert('Registration Failed', data.error || 'Something went wrong');
            }
          } catch (e: any) {
            Alert.alert('Network Error', e.message);
          }
        }} />
      <Dialog visible={done} title="Registration Successful" message="Welcome to Samanvi! Your account has been verified and registered with your 1km community boundary." onOk={() => { setDone(false); toMain(); }} />
    </RegShell>
  );
}


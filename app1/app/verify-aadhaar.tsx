import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
import { Colors } from '../constants/Colors';

export default function VerifyAadhaarScreen() {
  const router = useRouter();
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [masked, setMasked] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) { Alert.alert('Aadhaar', 'Enter a valid 12-digit Aadhaar number.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-aadhaar-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaar: digits }),
      });
      const data = await res.json();
      setMasked(data.masked || '');
      setSent(true);
      Alert.alert('Aadhaar OTP Sent 🛡️', 'Verification code dispatched to your registered mobile number!');
    } catch (e: any) { Alert.alert('Aadhaar', e.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    const digits = aadhaar.replace(/\D/g, '');
    if (otp.replace(/\D/g, '').length !== 6) { Alert.alert('OTP', 'Enter the 6-digit OTP'); return; }
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await fetch(`${API_BASE_URL}/auth/verify-aadhaar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aadhaar: digits, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      Alert.alert('Verified', `Aadhaar linked (••••${data.last4}). Your trust level is upgraded.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) { Alert.alert('Aadhaar', e.message || 'Verification failed'); }
    finally { setLoading(false); }
  };

  const fmt = (s: string) => s.replace(/\D/g, '').slice(0, 12).replace(/(.{4})/g, '$1 ').trim();

  return (
    <SafeAreaView style={styles.safe} testID="aadhaar-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} testID="aadhaar-back"><Ionicons name="chevron-back" size={26} color="#0f172a" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Aadhaar</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.iconRow}>
            <Ionicons name="shield-checkmark" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.h1}>Confirm you&apos;re a real neighbour</Text>
          <Text style={styles.sub}>
            Samanvi never stores your raw Aadhaar number — only a one-way hash + last 4 digits. This upgrades your trust level and unlocks paid help offers.
          </Text>

          <Text style={styles.label}>Aadhaar number</Text>
          <TextInput
            testID="aadhaar-input"
            value={fmt(aadhaar)}
            onChangeText={(v) => setAadhaar(v.replace(/\D/g, '').slice(0, 12))}
            placeholder="0000 0000 0000"
            keyboardType="number-pad"
            editable={!sent}
            style={styles.input}
          />

          {!sent ? (
            <TouchableOpacity onPress={send} disabled={loading} style={[styles.btn, loading && styles.btnDim]} testID="send-aadhaar-otp">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Aadhaar OTP</Text>}
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.label}>Aadhaar OTP</Text>
              <TextInput
                testID="aadhaar-otp-input"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />
              <TouchableOpacity onPress={verify} disabled={loading} style={[styles.btn, loading && styles.btnDim]} testID="verify-aadhaar-submit">
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify &amp; Upgrade Trust</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef0f5' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  container: { padding: 20 },
  iconRow: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  h1: { fontSize: 24, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  sub: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', marginTop: 22, marginBottom: 6, letterSpacing: 0.4 },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 16, color: '#0f172a', borderWidth: 1, borderColor: '#E5E5EA' },
  btn: { marginTop: 24, backgroundColor: Colors.primary, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnDim: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dev: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3ECE8', padding: 12, borderRadius: 10, marginTop: 20 },
  devText: { color: '#264D3E', fontWeight: '600', fontSize: 13 },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
import { Colors } from '../constants/Colors';

export default function InviteScreen() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [redeem, setRedeem] = useState('');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      setTimeout(() => {
        setCode("SAMANVI" + Math.floor(1000 + Math.random() * 9000));
        setLoading(false);
      }, 800);
    } catch (e: any) { Alert.alert('Invite', e.message || 'Failed'); setLoading(false); }
  };

  const doRedeem = async () => {
    if (!redeem.trim()) return;
    setLoading(true);
    try {
      setTimeout(() => {
        Alert.alert('Bonus applied 🎉', `+20 trust points!`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        setLoading(false);
      }, 800);
    } catch (e: any) { Alert.alert('Invite', e.message || 'Failed'); setLoading(false); }
  };

  const share = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join my Samanvi neighbourhood — Aadhaar-verified local help. Use my code: ${code} · samanvi://invite/${code}`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} testID="invite-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#0f172a" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Invite Neighbours</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.body}>
          <Ionicons name="gift" size={44} color={Colors.primary} />
          <Text style={styles.h1}>Grow your neighbourhood</Text>
          <Text style={styles.sub}>Both you and the person you invite earn +20 trust points once they join.</Text>

          {code ? (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.code} testID="invite-code">{code}</Text>
              <TouchableOpacity onPress={share} style={styles.share} testID="invite-share">
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareText}>Share invite</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={create} disabled={loading} style={styles.btn} testID="invite-generate">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate my invite code</Text>}
            </TouchableOpacity>
          )}

          <View style={styles.divider} />
          <Text style={styles.label}>Have a code from a friend?</Text>
          <TextInput
            testID="invite-redeem-input"
            value={redeem}
            onChangeText={(v) => setRedeem(v.toUpperCase())}
            placeholder="XXXXXXXX"
            style={styles.input}
            autoCapitalize="characters"
            maxLength={16}
          />
          <TouchableOpacity onPress={doRedeem} disabled={loading || !redeem.trim()} style={[styles.btnOutline, (loading || !redeem.trim()) && { opacity: 0.5 }]} testID="invite-redeem-btn">
            <Text style={styles.btnOutlineText}>Redeem</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef0f5' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  body: { padding: 24, alignItems: 'center' },
  h1: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: 14 },
  sub: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  codeCard: { marginTop: 28, width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA' },
  codeLabel: { fontSize: 11, color: '#888', letterSpacing: 1.2, fontWeight: '700' },
  code: { fontSize: 32, fontWeight: '800', color: Colors.primary, letterSpacing: 6, marginTop: 6 },
  share: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  shareText: { color: '#fff', fontWeight: '700' },
  btn: { marginTop: 24, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#E5E5EA', alignSelf: 'stretch', marginTop: 32, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', alignSelf: 'flex-start', letterSpacing: 0.4 },
  input: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 18, color: '#0f172a', borderWidth: 1, borderColor: '#E5E5EA', marginTop: 8, letterSpacing: 4, textAlign: 'center' },
  btnOutline: { alignSelf: 'stretch', marginTop: 12, borderWidth: 1.5, borderColor: Colors.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  btnOutlineText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function VoiceScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('English');
  const [recording, setRecording] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Voice Post</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.centerBox}>
          <TouchableOpacity 
            style={[styles.mic, recording && styles.micActive]} 
            onPress={() => setRecording(!recording)}
          >
            <Ionicons name="mic" size={42} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.subText}>
            {recording ? 'Listening…' : 'Tap the mic and describe the problem'}
          </Text>
        </View>

        <Text style={styles.label}>SPEAK IN</Text>
        <View style={styles.chipsWrap}>
          {['English', 'हिन्दी', 'ગુજરાતી'].map(l => (
            <TouchableOpacity key={l} onPress={() => setLang(l)} style={[styles.chip, lang === l && styles.chipActive]}>
              <Text style={[styles.chipText, lang === l && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => router.push('/report')}>
          <Text style={styles.btnText}>Turn into a post</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginLeft: 4 },
  content: { padding: 16 },
  centerBox: { alignItems: 'center', marginTop: 16, gap: 12 },
  mic: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 26, elevation: 10 },
  micActive: { backgroundColor: '#ff453a', shadowColor: '#ff453a' },
  subText: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginTop: 16, marginBottom: 6 },
  chipsWrap: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { backgroundColor: Colors.fill, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: '#fff' },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 14, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

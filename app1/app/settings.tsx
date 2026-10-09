import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';

export default function SettingsScreen() {
  const router = useRouter();
  const langs = ['English', 'हिन्दी', 'ગુજરાતી', 'తెలుగు'];
  const [lang, setLang] = useState('English');
  const [toggles, setToggles] = useState({ 0: true, 1: true, 2: false });

  useEffect(() => {
    SecureStore.getItemAsync('app_language').then(v => { if (v) setLang(v); });
    SecureStore.getItemAsync('app_toggles').then(v => { if (v) setToggles(JSON.parse(v)); });
  }, []);

  const changeLang = (l: string) => {
    setLang(l);
    SecureStore.setItemAsync('app_language', l);
  };

  const toggleMode = (i: number) => {
    setToggles(prev => {
      const next = { ...prev, [i]: !prev[i as keyof typeof toggles] };
      SecureStore.setItemAsync('app_toggles', JSON.stringify(next));
      return next;
    });
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('userToken');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Profile</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.label}>LANGUAGE (PLANNED)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {langs.map(l => (
            <TouchableOpacity key={l} onPress={() => changeLang(l)} style={[styles.chip, lang === l && styles.chipActive]}>
              <Text style={[styles.chipText, lang === l && styles.chipTextActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { marginTop: 14 }]}>HELPER MODE</Text>
        {['I am available to help now', 'Alert me about Critical issues', 'Night alerts (10 PM–6 AM)'].map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>{l}</Text>
            <TouchableOpacity onPress={() => toggleMode(i)} style={[styles.toggle, toggles[i as keyof typeof toggles] ? styles.toggleOn : styles.toggleOff]}>
              <View style={[styles.toggleKnob, toggles[i as keyof typeof toggles] ? styles.knobOn : styles.knobOff]} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[styles.row, { marginTop: 10 }]} onPress={() => router.push('/labs')}>
          <Text style={styles.rowTitle}>Smart Labs (upcoming)</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/privacy-dpdp')}>
          <Text style={styles.rowTitle}>Privacy and data</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/invite')}>
          <Text style={styles.rowTitle}>Invite neighbours</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnGhost} onPress={logout}>
          <Text style={[styles.btnText, { color: Colors.textPrimary }]}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginLeft: 4 },
  content: { padding: 16 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  chipScroll: { flexDirection: 'row', marginBottom: 16 },
  chip: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 16, marginBottom: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#30d158' },
  toggleOff: { backgroundColor: Colors.border },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  btnGhost: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 12, backgroundColor: Colors.surfaceSecondary },
  btnText: { fontSize: 16, fontWeight: '600' }
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function OfflineScreen() {
  const router = useRouter();
  
  const [toggles, setToggles] = useState({ 0: true, 1: true, 2: false });

  const toggleOpt = (i: number) => {
    setToggles(prev => ({ ...prev, [i]: !prev[i as keyof typeof toggles] }));
  };

  const opts = ['Save posts when offline', 'Download my 1 km map'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Offline Mode</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>No signal? Posts wait on your phone and send when you are back online.</Text>
        
        {opts.map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>{l}</Text>
            <TouchableOpacity onPress={() => toggleOpt(i)} style={[styles.toggle, toggles[i as keyof typeof toggles] ? styles.toggleOn : styles.toggleOff]}>
              <View style={[styles.toggleKnob, toggles[i as keyof typeof toggles] ? styles.knobOn : styles.knobOff]} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.rowBtn} onPress={() => router.push('/(tabs)/activity')}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>2 posts waiting to send</Text>
            <Text style={styles.rowSub}>Tap to view</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={() => {
          Alert.alert('Synced', '2 posts sent.', [{ text: 'OK', onPress: () => router.push('/(tabs)') }]);
        }}>
          <Text style={styles.btnText}>Sync now</Text>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 16, marginBottom: 8 },
  rowBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 12, marginBottom: 8 },
  rowContent: { flex: 1 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#30d158' },
  toggleOff: { backgroundColor: Colors.border },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 10, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

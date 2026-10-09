import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function ShareScreen() {
  const router = useRouter();
  const options = [
    { name: 'WhatsApp', icon: 'chatbubbles' as const },
    { name: 'SMS', icon: 'mail' as const },
    { name: 'Copy link', icon: 'list' as const }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Share Invite</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroBox}>
          <Text style={styles.heroSub}>YOUR INVITE CODE</Text>
          <Text style={styles.heroTitle}>SAM-4X9K</Text>
        </View>

        {options.map((opt, i) => (
          <TouchableOpacity key={i} style={styles.row} onPress={() => {
            import('react-native').then(({ Share }) => {
              Share.share({ message: 'Join Samanvi with my code SAM-4X9K to build a better neighbourhood!' });
            });
          }}>
            <View style={styles.iconBox}>
              <Ionicons name={opt.icon} size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.rowTitle}>{opt.name}</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
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
  heroBox: { borderRadius: 24, padding: 20, backgroundColor: Colors.primary, alignItems: 'center', marginBottom: 16, shadowColor: '#0a84ff', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 10 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroTitle: { fontSize: 30, fontWeight: '700', color: '#fff', letterSpacing: 5, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 12, marginBottom: 8, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.textPrimary }
});

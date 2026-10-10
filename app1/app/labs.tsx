import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function LabsScreen() {
  const router = useRouter();
  
  const features = [
    { emoji: '🎙️', title: 'Voice Post', desc: 'Speak the problem in your language', route: '/voice' },
    { emoji: '📴', title: 'Offline Sync', desc: 'Post and SOS save when without signal', route: '/offline' },
    { emoji: '🔳', title: 'QR Check-in', desc: 'Scan instead of typing a PIN', route: '/qr' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Smart Labs</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Previews of upcoming features. They show how each will work and are not in the current build.</Text>
        
        {features.map((f, i) => (
          <TouchableOpacity key={i} style={styles.row} onPress={() => router.push(f.route as any)}>
            <Text style={styles.emoji}>{f.emoji}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{f.title}</Text>
              <Text style={styles.rowSub}>{f.desc}</Text>
            </View>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: 12, marginBottom: 8, gap: 12 },
  emoji: { fontSize: 24 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary }
});

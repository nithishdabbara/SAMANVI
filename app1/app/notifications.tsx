import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const NOTIFICATIONS = [
  { id: 1, icon: 'people', title: 'Neighbor offered to help', desc: 'Waterlogged footpath · 2 min ago', color: '#0a84ff', route: '/offers' },
  { id: 2, icon: 'checkmark-circle', title: 'Arrival PIN verified', desc: 'Helper reached your location', color: '#30d158', route: '/chat/1' },
  { id: 3, icon: 'star', title: 'You received +12 trust points', desc: 'Rated 5 stars by a neighbor', color: '#ff9f0a', route: '/(tabs)/profile' },
  { id: 4, icon: 'alert', title: 'Critical issue 0.4 km away', desc: 'Open manhole near Gate 3', color: '#ff453a', route: '/(tabs)/explore' },
  { id: 5, icon: 'shield-checkmark', title: 'Aadhaar verified', desc: 'Your profile now shows ✓ Verified', color: '#5e5ce6', route: '/(tabs)/profile' }
];

export default function NotificationsScreen() {
  const router = useRouter();
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Alerts</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
        {NOTIFICATIONS.map(n => (
          <TouchableOpacity key={n.id} style={styles.row} onPress={() => router.push(n.route as any)}>
            <View style={[styles.iconBox, { backgroundColor: n.color + '22' }]}>
              <Ionicons name={n.icon as any} size={20} color={n.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.desc}>{n.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  list: { flex: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.03, shadowRadius: 8 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  desc: { fontSize: 13, color: '#64748b' }
});

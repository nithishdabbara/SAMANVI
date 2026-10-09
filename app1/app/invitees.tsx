import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function InviteesScreen() {
  const router = useRouter();
  const invitees = [
    { name: 'Meera S', status: 'Joined', color: '#30d158', desc: '+5 points earned' },
    { name: 'Raj P', status: 'Joined', color: '#30d158', desc: '+5 points earned' },
    { name: 'Karan D', status: 'Pending', color: '#ff9f0a', desc: 'Has not used the code yet' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Invited Neighbours</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {invitees.map((inv, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{inv.name[0]}</Text></View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{inv.name}</Text>
              <Text style={styles.rowSub}>{inv.desc}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: inv.color + '22' }]}>
              <Text style={[styles.statusText, { color: inv.color }]}>{inv.status}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={() => router.push('/share')}>
          <Text style={styles.btnText}>Invite more</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 12, marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: '600' },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 12, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

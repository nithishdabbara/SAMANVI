import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function SOSDoneScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Emergency</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.centerBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={52} color="#fff" />
          </View>
          <Text style={styles.title}>SOS sent</Text>
          <Text style={styles.subtitle}>Neighbours and admins within 1 km can see your live location.</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/chat/1')}>
          <View style={styles.avatar}><Text style={styles.avatarText}>N</Text></View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Neighbors are on the way</Text>
            <Text style={styles.rowSub}>0.3 km · tap to message</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/')}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>See responders on the map</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.btnText, { color: Colors.textPrimary }]}>Cancel SOS</Text>
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
  centerBox: { alignItems: 'center', marginTop: 24, gap: 10, marginBottom: 24 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#30d158', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 12, marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 10, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnGhost: { backgroundColor: '#f1f5f9' }
});

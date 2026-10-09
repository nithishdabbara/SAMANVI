import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PayScreen() {
  const router = useRouter();
  const { helperName = 'Your Helper' } = useLocalSearchParams();
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Pay Helper</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.profileBox}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{String(helperName).charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.name}>{helperName}</Text>
          <Text style={styles.job}>Plumbing · agreed price</Text>
        </View>
        
        <View style={styles.amountHero}>
          <Text style={styles.amountLabel}>AMOUNT</Text>
          <Text style={styles.amountText}>₹ 350</Text>
        </View>
        
        <Text style={styles.sectionTitle}>PAY WITH UPI</Text>
        
        {['Google Pay', 'PhonePe', 'Paytm'].map((app, i) => (
          <TouchableOpacity key={i} style={styles.appRow} onPress={() => router.push('/resolve' as any)}>
            <View style={styles.appIcon}><Ionicons name="wallet" size={20} color="#0f172a"/></View>
            <Text style={styles.appName}>{app}</Text>
            {i === 0 && <View style={styles.badge}><Text style={styles.badgeText}>Last used</Text></View>}
          </TouchableOpacity>
        ))}
        
        <Text style={styles.footerNote}>Optional. Free help never needs payment.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  content: { flex: 1, padding: 20 },
  profileBox: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0a84ff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  job: { fontSize: 13, color: '#64748b' },
  amountHero: { backgroundColor: '#0a84ff', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 30, shadowColor: '#0a84ff', shadowOffset: {width:0,height:10}, shadowOpacity: 0.3, shadowRadius: 20 },
  amountLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, fontWeight: '700' },
  amountText: { fontSize: 44, fontWeight: '800', color: '#FFF' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 12 },
  appRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.03, shadowRadius: 8 },
  appIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  appName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  badge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  footerNote: { textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 10 }
});

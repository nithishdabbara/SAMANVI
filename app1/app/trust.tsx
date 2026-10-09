import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function TrustScreen() {
  const router = useRouter();
  const [trustScore, setTrustScore] = useState<number | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // The backend returns it usually out of 100, we can divide by 20 to get a 5-star equivalent if we want, or just show the raw score.
        // Assuming trust_score starts at 50.0
        setTrustScore(data.trust_score || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Trust Score</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroSub}>COMMUNITY TRUST SCORE</Text>
          {trustScore === null ? (
            <ActivityIndicator color="#FFF" style={{ marginVertical: 10 }} />
          ) : (
            <Text style={styles.heroScore}>{trustScore}</Text>
          )}
          <Text style={styles.heroDesc}>Built from verified help only</Text>
        </View>
        
        <View style={styles.barsContainer}>
          {[
            { label: 'Verified tasks', val: 92, color: '#30d158' },
            { label: 'Ratings', val: 96, color: '#ff9f0a' },
            { label: 'Response speed', val: 84, color: '#0a84ff' },
            { label: 'Reports against you', val: 4, color: '#ff453a' },
          ].map((item, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={styles.barLabelRow}>
                <Text style={styles.barLabel}>{item.label}</Text>
                <Text style={styles.barVal}>{item.val}%</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${item.val}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
        </View>
        
        <Text style={styles.sectionTitle}>BADGES</Text>
        <View style={styles.badges}>
          <View style={styles.badge}><Text style={styles.badgeText}>First Responder</Text></View>
          <View style={[styles.badge, {backgroundColor: '#30d158'}]}><Text style={[styles.badgeText, {color: '#FFF'}]}>10 Helps</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>Night Owl</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>50 Helps</Text></View>
        </View>
        <TouchableOpacity style={styles.navRow} onPress={() => router.push('/leaderboard' as any)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.navRowTitle}>Top neighbours</Text>
            <Text style={styles.navRowSub}>See who is helping most this month</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#0a84ff" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  content: { flex: 1, padding: 20 },
  hero: { alignItems: 'center', backgroundColor: '#0a84ff', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#0a84ff', shadowOffset: {width:0,height:10}, shadowOpacity: 0.3, shadowRadius: 20 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroScore: { color: '#FFF', fontSize: 46, fontWeight: '800', marginVertical: 4 },
  heroDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  barsContainer: { marginBottom: 20 },
  barWrapper: { marginBottom: 16 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  barVal: { fontSize: 13, color: '#64748b' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#e2e8f0' },
  barFill: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  navRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.03, shadowRadius: 8 },
  navRowTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  navRowSub: { fontSize: 13, color: '#64748b' }
});

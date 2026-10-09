import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function HubScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setError(true);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error fetching hub stats:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (label: string) => {
    switch(label.toLowerCase()) {
      case 'water': return '💧';
      case 'electricity': return '⚡';
      case 'road': return '🚧';
      case 'safety': return '🛡️';
      case 'sanitation': return '🗑️';
      case 'home repairs & plumbing': return '🔧';
      case 'tutoring & tech help': return '💻';
      case 'borrowing tools': return '🛠️';
      case 'errands & moving': return '📦';
      case 'community event': return '🎉';
      default: return '📌';
    }
  };

  const tiles = [
    { label: 'Water' },
    { label: 'Electricity' },
    { label: 'Road' },
    { label: 'Safety' },
    { label: 'Sanitation' },
    { label: 'Home Repairs & Plumbing' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Local Hub</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#0a84ff" />
            <Text style={styles.stateText}>Loading community stats...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
            <Text style={styles.stateText}>Failed to load community statistics.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStats}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !stats ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>No data available for your neighborhood.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Your Neighborhood • 1 km</Text>
              <Text style={styles.heroSub}>
                {stats.community_members ?? 0} community members • {stats.open_issues ?? 0} open • {stats.issues_solved ?? 0} solved this month
              </Text>
            </View>
            
            <View style={styles.grid}>
              {tiles.map((item, i) => {
                const count = stats.category_counts?.[item.label] ?? 0;
                return (
                  <TouchableOpacity key={i} style={styles.tile} onPress={() => router.push('/(tabs)/explore')}>
                    <Text style={styles.tileIcon}>{getCategoryIcon(item.label)}</Text>
                    <Text style={styles.tileLabel}>{item.label}</Text>
                    <Text style={styles.tileCount}>{count} open</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        
        <Text style={styles.sectionTitle}>Community notices</Text>
        <View style={styles.emptyNoticeCard}>
          <Ionicons name="notifications-off-outline" size={32} color="#94a3b8" />
          <Text style={styles.emptyNoticeText}>No community notices at this time.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  content: { flex: 1, padding: 16 },
  hero: { backgroundColor: '#0a84ff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#0a84ff', shadowOffset: {width:0,height:10}, shadowOpacity: 0.3, shadowRadius: 20 },
  heroTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  tile: { width: '31%', backgroundColor: '#FFF', borderRadius: 20, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 8 },
  tileIcon: { fontSize: 26, marginBottom: 8 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  tileCount: { fontSize: 11, color: '#64748b' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  emptyNoticeCard: { backgroundColor: '#f1f5f9', padding: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emptyNoticeText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  stateContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  stateText: { fontSize: 15, color: '#64748b', marginTop: 12, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: '#0a84ff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  retryBtnText: { color: '#FFF', fontWeight: 'bold' }
});


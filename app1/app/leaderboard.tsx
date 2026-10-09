import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Month');

  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await fetch(`${API_BASE_URL}/helpers?sort=top`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaders(data.helpers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Top Neighbours</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.segmentedControl}>
        <TouchableOpacity 
          style={activeTab === 'Week' ? styles.segmentActive : styles.segment}
          onPress={() => setActiveTab('Week')}
        >
          <Text style={activeTab === 'Week' ? styles.segmentActiveText : styles.segmentText}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={activeTab === 'Month' ? styles.segmentActive : styles.segment}
          onPress={() => setActiveTab('Month')}
        >
          <Text style={activeTab === 'Month' ? styles.segmentActiveText : styles.segmentText}>Month</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={activeTab === 'All time' ? styles.segmentActive : styles.segment}
          onPress={() => setActiveTab('All time')}
        >
          <Text style={activeTab === 'All time' ? styles.segmentActiveText : styles.segmentText}>All time</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#0a84ff" style={{ marginTop: 40 }} />
        ) : (
          (activeTab === 'Week' ? leaders.slice(0, 3) : activeTab === 'Month' ? leaders.slice(0, 10) : leaders).map((item, i) => (
            <TouchableOpacity key={item.id} style={styles.row} onPress={() => router.push(`/user/${item.id}` as any)}>
              <Text style={styles.rank}>{i+1}</Text>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.skill}>{item.skills?.join(', ') || 'General'}</Text>
              </View>
              <Text style={styles.points}>{Math.round(item.trust_score)}</Text>
            </TouchableOpacity>
          ))
        )}
        
        <View style={styles.nextBadgeCard}>
          <Text style={styles.nextBadgeTitle}>Your next badge</Text>
          <Text style={styles.nextBadgeSub}>38 more helps to unlock 50 Helps.</Text>
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
  segmentedControl: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 16 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  segmentActive: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, shadowColor: '#000', shadowOffset: {width:0,height:1}, shadowOpacity: 0.1, shadowRadius: 2 },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentActiveText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  content: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.03, shadowRadius: 8 },
  rank: { width: 26, fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0a84ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  skill: { fontSize: 13, color: '#64748b' },
  points: { fontSize: 16, fontWeight: '800', color: '#0a84ff' },
  nextBadgeCard: { backgroundColor: '#e6f2ff', padding: 16, borderRadius: 16, marginTop: 10 },
  nextBadgeTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  nextBadgeSub: { fontSize: 13, color: '#64748b' }
});

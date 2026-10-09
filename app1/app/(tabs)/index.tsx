import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../constants/Config';

const { width } = Dimensions.get('window');
const GRID_PAD = 20;
const GAP = 14;
const ITEM_W = (width - (GRID_PAD * 2) - (GAP * 2)) / 3;

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [score, setScore] = useState(50); // Default trust score
  const [location, setLocation] = useState('My Neighborhood');
  const [online, setOnline] = useState(0);
  const [solved, setSolved] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        // Fallbacks
        const storedName = await SecureStore.getItemAsync('userName');
        if (storedName) setUserName(storedName.split(' ')[0]);

        // Real fetch
        const res = await fetch(`${API_BASE_URL}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const p = data.profile || {};
          if (p.name) setUserName(p.name.split(' ')[0]);
          if (p.trust_score !== undefined) setScore(p.trust_score);
          if (p.address) setLocation(p.address.split(',')[0]);
        }

        // Fetch community stats instead of Math.random()
        const statsRes = await fetch(`${API_BASE_URL}/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.neighbors_online !== undefined) setOnline(statsData.neighbors_online);
          if (statsData.issues_solved !== undefined) setSolved(statsData.issues_solved);
        }
      } catch (e) {
        console.log('Error fetching stats:', e);
      }
    })();
  }, []);

  const TABS = [
    { key: 'post', title: 'Post Problem', icon: 'alert', color: '#FF3B30', route: '/(tabs)/post' },
    { key: 'helpers', title: 'Find Helpers', icon: 'people', color: '#0A84FF', route: '/(tabs)/explore' },
    { key: 'activity', title: 'My Activity', icon: 'stats-chart', color: '#FF9500', route: '/(tabs)/activity' },
    { key: 'inbox', title: 'Messages', icon: 'chatbubbles', color: '#5E5CE6', route: '/(tabs)/messages' },
    { key: 'hub', title: 'Local Hub', icon: 'business', color: '#32ADE6', route: '/hub' },
    { key: 'emergency', title: 'Emergency', icon: 'warning', color: '#FF3B30', route: '/sos' },
    { key: 'trust', title: 'Trust Score', icon: 'star', color: '#FF9500', route: '/trust' },
    { key: 'top', title: 'Top Neighbors', icon: 'heart', color: '#34C759', route: '/leaderboard' },
    { key: 'settings', title: 'Settings', icon: 'settings', color: '#5E5CE6', route: '/settings' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LinearGradient colors={['#64D2FF', '#0A84FF']} style={styles.avatar}>
              <Text style={styles.avatarText}>{userName[0]}</Text>
            </LinearGradient>
            <View>
              <Text style={styles.greeting}>Hello, {userName || 'Neighbor'} 👋</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location" size={12} color="#64748B" />
                <Text style={styles.location}>{location}</Text>
              </View>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable style={styles.bell} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={24} color="#0F172A" />
              <View style={styles.bellDot} />
            </Pressable>
            <Pressable style={styles.scorePill} onPress={() => router.push('/trust')}>
              <Ionicons name="star" size={12} color="#FFF" />
              <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero */}
        <LinearGradient colors={['#0A84FF', '#5E5CE6']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.hero}>
          <Text style={styles.heroTitle}>Connect. Help. Solve.</Text>
          <Text style={styles.heroSub}>Your local community is here — post problems, find nearby helpers.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={styles.heroTag}><View style={styles.dot} /><Text style={styles.tagText}>{online} neighbors online</Text></View>
            <View style={styles.heroTag}><Ionicons name="checkmark" size={14} color="#FFF" /><Text style={styles.tagText}>{solved} issues solved</Text></View>
          </View>
        </LinearGradient>

        {/* Grid */}
        <View style={styles.grid}>
          {TABS.map((t) => (
            <Pressable key={t.key} style={styles.gridItem} onPress={() => router.push(t.route as any)}>
              <View style={[styles.iconBox, { backgroundColor: t.color + '1A' }]}>
                <Ionicons name={t.icon as any} size={26} color={t.color} />
              </View>
              <Text style={styles.gridText}>{t.title}</Text>
            </Pressable>
          ))}
        </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  location: { fontSize: 12, color: '#64748B', marginLeft: 4, fontWeight: '500' },
  bell: { padding: 4 },
  bellDot: { position: 'absolute', top: 4, right: 6, width: 8, height: 8, backgroundColor: '#FF3B30', borderRadius: 4 },
  scorePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF9500', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  scoreText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  
  hero: { marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#0A84FF', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  heroTitle: { color: '#FFF', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  heroTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  tagText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GRID_PAD, gap: GAP },
  gridItem: { width: ITEM_W, aspectRatio: 0.95, backgroundColor: '#FFF', borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  iconBox: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridText: { fontSize: 12, fontWeight: '600', color: '#0F172A', textAlign: 'center' }
});
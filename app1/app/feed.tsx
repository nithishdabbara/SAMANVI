import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
export default function FeedScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [urgFilter, setUrgFilter] = useState('All');
  const [problems, setProblems] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchFeed = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        // We use a wide radius and fallback lat/lng for the global feed
        const lat = await SecureStore.getItemAsync('userLat') || '22.31';
        const lng = await SecureStore.getItemAsync('userLng') || '73.18';
        const response = await fetch(`${API_BASE_URL}/problems?lat=${lat}&lng=${lng}&radius=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
          // Map backend fields to the UI schema
          const mapped = data.problems.map((p: any) => ({
            id: p.id,
            title: p.title,
            category: p.category || 'General',
            dist: (p.distance_km || 0).toFixed(1),
            urgency: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
            color: p.priority === 'critical' ? '#ff453a' : p.priority === 'high' ? '#ff6a3d' : '#ff9f0a'
          }));
          setProblems(mapped);
        }
      } catch (e) {
        console.log('Error fetching feed:', e);
      }
    };
    fetchFeed();
  }, []);

  const categories = ['All', 'Water', 'Electricity', 'Road', 'Safety', 'Skills', 'Elderly'];
  const urgencies = ['All', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = problems.filter(p => {
    if (catFilter !== 'All' && p.category !== catFilter) return false;
    if (urgFilter !== 'All' && p.urgency !== urgFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Problems Nearby</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search problems" 
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <Text style={styles.label}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {categories.map(c => (
            <TouchableOpacity key={c} onPress={() => setCatFilter(c)} style={[styles.chip, catFilter === c && styles.chipActive]}>
              <Text style={[styles.chipText, catFilter === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>URGENCY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {urgencies.map(u => (
            <TouchableOpacity key={u} onPress={() => setUrgFilter(u)} style={[styles.chip, urgFilter === u && styles.chipActive]}>
              <Text style={[styles.chipText, urgFilter === u && styles.chipTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/explore')} style={[styles.chip, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.chipText, { color: '#fff' }]}>Map view</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.list}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>Nothing matches. Clear a filter to see more.</Text>
          ) : (
            filtered.map(p => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => router.push(`/problem/${p.id}` as any)}>
                <View style={[styles.dot, { backgroundColor: p.color }]} />
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>{p.title}</Text>
                  <Text style={styles.rowSub}>{p.category} · {p.dist} km · {p.urgency}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginLeft: 4 },
  content: { paddingHorizontal: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: Colors.textPrimary },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  chipScroll: { flexDirection: 'row', marginBottom: 16 },
  chip: { backgroundColor: Colors.surfaceSecondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginRight: 8 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  chipTextActive: { color: '#fff' },
  list: { marginTop: 8, paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 30, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  rowSub: { fontSize: 13, color: Colors.textSecondary }
});

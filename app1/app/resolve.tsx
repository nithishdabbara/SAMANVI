import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResolveScreen() {
  const router = useRouter();
  const { helperName = 'your neighbor' } = useLocalSearchParams();
  const [rating, setRating] = useState(5);
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={52} color="#FFF" />
        </View>
        <Text style={styles.title}>Problem resolved!</Text>
        <Text style={styles.subtitle}>How was {helperName}'s help?</Text>
        
        <View style={styles.starsContainer}>
          {[1,2,3,4,5].map(i => (
            <TouchableOpacity key={i} onPress={() => setRating(i)}>
              <Ionicons name={i <= rating ? "star" : "star-outline"} size={38} color="#ff9f0a" />
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.rewardBox}>
          <Text style={styles.rewardText}>+12 trust points for {helperName}</Text>
        </View>
        
        <TouchableOpacity style={styles.submitBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.submitBtnText}>Submit Rating</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0a84ff', fontSize: 16, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', paddingTop: 30, paddingHorizontal: 20 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#30d158', justifyContent: 'center', alignItems: 'center', shadowColor: '#30d158', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 8, marginBottom: 24 },
  starsContainer: { flexDirection: 'row', gap: 6, marginBottom: 30 },
  rewardBox: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginBottom: 30 },
  rewardText: { color: '#30d158', fontWeight: '700', fontSize: 14 },
  submitBtn: { width: '100%', backgroundColor: '#0a84ff', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  navRow: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 16, borderRadius: 16 },
  navRowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' }
});

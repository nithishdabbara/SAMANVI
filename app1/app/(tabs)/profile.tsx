import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import { ErrorState } from '@/components/FeedbackState';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(false);
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setError(true);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const statItem = (icon: any, count: number, label: string, color: string) => (
    <View style={[styles.statBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#ffffffcc" />
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/editprofile' as any)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={24} color="#0a84ff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings' as any)} style={styles.actionBtn}>
            <Ionicons name="settings-outline" size={24} color="#0a84ff" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#0a84ff" />
            <Text style={styles.stateText}>Loading profile...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <ErrorState onRetry={fetchProfile} message="Failed to load your profile." />
          </View>
        ) : !profile ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>Profile data unavailable.</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/trust' as any)}>
              <Image 
                source={{ uri: profile.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} 
                style={styles.avatar} 
              />
              <View style={styles.profileInfo}>
                <Text style={styles.nameText}>{profile.name}</Text>
                <View style={styles.badges}>
                  {profile.verification_level === 'verified' && (
                    <View style={styles.badge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                      <Text style={styles.badgeText}>Verified</Text>
                    </View>
                  )}
                  <View style={styles.badge}>
                    <Ionicons name="shield-checkmark" size={14} color="#0a84ff" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeText}>Trust {profile.trust_score?.toFixed(1) || 'N/A'}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
            
            {profile.skills && profile.skills.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Helping skills</Text>
                <View style={styles.skillsContainer}>
                  {profile.skills.map((skill: string, idx: number) => (
                    <View key={idx} style={styles.skillChip}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.statsContainer}>
              {statItem('people', profile.people_helped || 0, 'Helped', '#0a84ff')}
              {statItem('heart', profile.helps_received || 0, 'Received', '#10B981')}
              {statItem('star', profile.community_helps || 0, 'Community', '#6366f1')}
            </View>

            <View style={styles.menuList}>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/activity' as any)}>
                <Ionicons name="document-text" size={24} color="#0a84ff" style={styles.menuIcon} />
                <Text style={styles.menuText}>Problems Posted</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/activity' as any)}>
                <Ionicons name="hand-left" size={24} color="#10B981" style={styles.menuIcon} />
                <Text style={styles.menuText}>Problems Helped</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/activity' as any)}>
                <Ionicons name="time" size={24} color="#f59e0b" style={styles.menuIcon} />
                <Text style={styles.menuText}>Ongoing Tasks</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/leaderboard' as any)}>
                <Ionicons name="trophy" size={24} color="#f59e0b" style={styles.menuIcon} />
                <Text style={styles.menuText}>Leaderboard</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/invite' as any)}>
                <Ionicons name="person-add" size={24} color="#8b5cf6" style={styles.menuIcon} />
                <Text style={styles.menuText}>Invite Neighbours</Text>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  headerActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { padding: 4 },
  content: { flex: 1, paddingHorizontal: 16 },
  profileCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginRight: 16, backgroundColor: '#f1f5f9' },
  profileInfo: { flex: 1 },
  nameText: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12, marginLeft: 4 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: { backgroundColor: '#e0e7ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  skillText: { color: '#4338ca', fontWeight: '600', fontSize: 14 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  statBox: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center' },
  statCount: { color: '#FFF', fontSize: 24, fontWeight: '800', marginVertical: 4 },
  statLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  menuList: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIcon: { marginRight: 16 },
  menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#334155' },
  stateContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  stateText: { fontSize: 15, color: '#64748b', marginTop: 12, textAlign: 'center' },
});
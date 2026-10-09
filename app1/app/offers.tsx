import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function OffersScreen() {
  const router = useRouter();
  const { problemId } = useLocalSearchParams();
  const [problem, setProblem] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [problemId]);

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      // If no problemId is passed (e.g. from a mock notification), fetch the user's own problems and pick the latest active one.
      let targetId = problemId;
      if (!targetId) {
        const resActivity = await fetch(`${API_BASE_URL}/user/activity`, { headers: { Authorization: `Bearer ${token}` } });
        const actData = await resActivity.json();
        const activeProblems = actData.posted?.filter((p: any) => p.status === 'open') || [];
        if (activeProblems.length > 0) {
          targetId = activeProblems[0].id;
        } else {
          setLoading(false);
          return;
        }
      }

      const probRes = await fetch(`${API_BASE_URL}/problems/${targetId}`);
      if (probRes.ok) {
        setProblem((await probRes.json()).problem);
      }

      const offRes = await fetch(`${API_BASE_URL}/problems/${targetId}/offers`, { headers: { Authorization: `Bearer ${token}` } });
      if (offRes.ok) {
        setOffers((await offRes.json()).offers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (offerId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await fetch(`${API_BASE_URL}/offers/${offerId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        Alert.alert("Success", "Offer accepted!");
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const handleDecline = async (offerId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await fetch(`${API_BASE_URL}/offers/${offerId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Help Offers</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#0a84ff" style={{ marginTop: 40 }} />
        ) : !problem ? (
          <Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>No active problems or offers found.</Text>
        ) : (
          <>
            <View style={styles.problemCard}>
              <View style={[styles.dot, { backgroundColor: problem.priority === 'critical' ? '#ff453a' : '#ff9f0a' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.problemTitle}>{problem.title}</Text>
                <Text style={styles.problemSub}>{problem.category} · {problem.priority} · {offers.length} offers</Text>
              </View>
            </View>
            
            {offers.filter(o => o.status === 'pending' || o.status === 'accepted').length === 0 && (
              <Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>No pending offers.</Text>
            )}

            {offers.filter(o => o.status === 'pending' || o.status === 'accepted').map(offer => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{offer.user?.[0] || 'U'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offerName}>{offer.user} {offer.trust_score > 70 && <Ionicons name="checkmark-circle" size={14} color="#0a84ff"/>}</Text>
                    <Text style={styles.offerStats}>{offer.skills || 'General'} · Trust: {Math.round(offer.trust_score)}</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>★ {((offer.trust_score / 100) * 5).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={styles.offerMsg}>"{offer.text}"</Text>
                <View style={styles.btnRow}>
                  {offer.status === 'accepted' ? (
                    <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Offer Accepted</Text>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(offer.id)}>
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(offer.id)}>
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
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
  problemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 14, borderRadius: 16, marginBottom: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff453a', marginRight: 12 },
  problemTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  problemSub: { fontSize: 13, color: '#64748b' },
  offerCard: { backgroundColor: '#FFF', borderRadius: 22, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.04, shadowRadius: 10 },
  offerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a84ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  offerName: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  offerStats: { fontSize: 13, color: '#64748b' },
  ratingBadge: { backgroundColor: '#ff9f0a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  ratingText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  offerMsg: { fontSize: 14, color: '#475569', fontStyle: 'italic', marginBottom: 16, backgroundColor: '#f8fafc', padding: 10, borderRadius: 10 },
  btnRow: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#0a84ff', padding: 12, borderRadius: 14, alignItems: 'center' },
  acceptBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  declineBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 14, alignItems: 'center' },
  declineBtnText: { color: '#0f172a', fontSize: 15, fontWeight: '700' }
});

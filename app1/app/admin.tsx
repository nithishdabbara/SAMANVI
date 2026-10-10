import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const isWeb = width > 768;
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync('userToken').then(token => {
      if (!token) {
        router.replace('/');
        return;
      }
      fetch(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data?.profile?.role !== 'admin') {
          router.replace('/');
        }
      })
      .catch(() => router.replace('/'));
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.adminCard, { maxWidth: isWeb ? 920 : '100%', marginHorizontal: isWeb ? 'auto' : 16 }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="shield-checkmark" size={24} color="#0a84ff" />
            </View>
            <Text style={styles.headerTitle}>Samanvi Admin</Text>
            <View style={styles.filterPills}>
              <View style={[styles.pill, styles.pillActive]}><Text style={styles.pillActiveText}>Urgency: All</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>Last 7 days</Text></View>
            </View>
          </View>

          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Open issues</Text>
              <Text style={[styles.metricValue, {color: '#0a84ff'}]}>128</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Critical</Text>
              <Text style={[styles.metricValue, {color: '#ff453a'}]}>9</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Resolved</Text>
              <Text style={[styles.metricValue, {color: '#30d158'}]}>74%</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Flagged accounts</Text>
              <Text style={[styles.metricValue, {color: '#ff9f0a'}]}>3</Text>
            </View>
          </View>

          {/* Problem Heatmap */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problem heatmap</Text>
            <View style={styles.heatmapBox}>
              <Svg width="100%" height="100%" viewBox="0 0 800 240" preserveAspectRatio="none">
                <Defs>
                  <RadialGradient id="hg">
                    <Stop offset="0" stopColor="#ff453a" stopOpacity="0.8" />
                    <Stop offset="0.5" stopColor="#ff9f0a" stopOpacity="0.45" />
                    <Stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Path d="M0 60 800 110M200 0 260 240M0 190 800 150M560 0 520 240" stroke="#fff" strokeWidth="12" fill="none" />
                <Circle cx="250" cy="110" r="90" fill="url(#hg)" />
                <Circle cx="560" cy="150" r="70" fill="url(#hg)" />
                <Circle cx="420" cy="70" r="50" fill="url(#hg)" />
                <Circle cx="680" cy="70" r="40" fill="url(#hg)" />
              </Svg>
            </View>
          </View>

          {/* Flagged Accounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flagged accounts</Text>
            
            <View style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>U</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>user_4821</Text>
                <Text style={styles.rowSub}>Reported 3× · spam posts</Text>
              </View>
              <TouchableOpacity style={styles.btnSecondary}><Text style={styles.btnSecondaryText}>Review</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger}><Text style={styles.btnDangerText}>Remove</Text></TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={styles.avatar}><Text style={styles.avatarText}>U</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>user_1093</Text>
                <Text style={styles.rowSub}>Malicious behaviour report</Text>
              </View>
              <TouchableOpacity style={styles.btnSecondary}><Text style={styles.btnSecondaryText}>Review</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger}><Text style={styles.btnDangerText}>Remove</Text></TouchableOpacity>
            </View>
          </View>

          {/* Escalated */}
          <View style={[styles.section, { borderBottomWidth: 0, paddingBottom: 24 }]}>
            <Text style={styles.sectionTitle}>Escalated to municipal office</Text>
            
            <View style={styles.row}>
              <View style={[styles.dot, {backgroundColor: '#ff453a'}]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Open manhole · Gate 3</Text>
                <Text style={styles.rowSub}>Ticket #VMC-2291 · sent 2 h ago</Text>
              </View>
              <View style={styles.statusPill}><Text style={styles.statusPillText}>Pending</Text></View>
            </View>

            <View style={styles.row}>
              <View style={[styles.dot, {backgroundColor: '#ff9f0a'}]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Burst water pipe · Sector 4</Text>
                <Text style={styles.rowSub}>Ticket #VMC-2288 · sent yesterday</Text>
              </View>
              <View style={styles.statusPill}><Text style={styles.statusPillText}>Acknowledged</Text></View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  scrollContent: { paddingVertical: 20 },
  adminCard: { backgroundColor: '#FFF', borderRadius: 20, shadowColor: '#000', shadowOffset: {width:0,height:20}, shadowOpacity: 0.05, shadowRadius: 50, elevation: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10, flexWrap: 'wrap' },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#e6f2ff', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#0f172a' },
  filterPills: { flexDirection: 'row', gap: 8 },
  pill: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  pillActive: { backgroundColor: '#0a84ff' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  pillActiveText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 18, gap: 12 },
  metricCard: { flex: 1, minWidth: 130, backgroundColor: '#f1f5f9', borderRadius: 16, padding: 14 },
  metricLabel: { fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 4 },
  metricValue: { fontSize: 26, fontWeight: '800' },
  section: { paddingHorizontal: 18, paddingBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  heatmapBox: { height: 240, backgroundColor: '#e8efe3', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  heatmapText: { color: '#30d158', fontWeight: '700', fontSize: 16, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 12, marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a84ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  rowSub: { fontSize: 13, color: '#64748b' },
  btnSecondary: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  btnSecondaryText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  btnDanger: { backgroundColor: '#ff453a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  btnDangerText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  statusPill: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  statusPillText: { fontSize: 12, fontWeight: '600', color: '#0f172a' }
});

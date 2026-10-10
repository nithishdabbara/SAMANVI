import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.log('Error fetching notifications', e);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string, route: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {}
    router.push(route as any);
  };

  const getIcon = (type: string) => {
    if (type === 'message') return { name: 'chatbubbles', color: '#0a84ff' };
    if (type === 'offer') return { name: 'people', color: '#0a84ff' };
    if (type === 'arrival_verified') return { name: 'checkmark-circle', color: '#30d158' };
    if (type === 'problem_resolved') return { name: 'star', color: '#ff9f0a' };
    if (type === 'sos') return { name: 'alert', color: '#ff453a' };
    return { name: 'notifications', color: '#5e5ce6' };
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Alerts</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0a84ff" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 40 }}>
          {notifications.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 40, color: '#64748b' }}>No notifications yet.</Text>
          ) : (
            notifications.map(n => {
              const ic = getIcon(n.type);
              const isUnread = !n.is_read;
              return (
                <TouchableOpacity key={n.id} style={[styles.row, isUnread && styles.unreadRow]} onPress={() => markRead(n.id, n.data_route || '/(tabs)')}>
                  <View style={[styles.iconBox, { backgroundColor: ic.color + '22' }]}>
                    <Ionicons name={ic.name as any} size={20} color={ic.color} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={[styles.title, isUnread && {fontWeight: '800'}]}>{n.title}</Text>
                    <Text style={styles.desc}>{n.message}</Text>
                  </View>
                  {isUnread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  list: { flex: 1, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.03, shadowRadius: 8 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  desc: { fontSize: 13, color: '#64748b' },
  unreadRow: { backgroundColor: '#F0F7FF', borderColor: '#BAE6FD', borderWidth: 1 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0a84ff', marginLeft: 8 }
});

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
import { Colors } from '../constants/Colors';

export default function PrivacyDpdpScreen() {
  const router = useRouter();
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API_BASE_URL}/dpdp/policy`);
      setPolicy(await r.json());
    })();
  }, []);

  const exportData = () => {
    router.push('/export');
  };

  const deleteAccount = () => {
    Alert.alert('Delete account?', 'Your posts and trust score will be removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await SecureStore.getItemAsync('userToken');
          const res = await fetch(`${API_BASE_URL}/users/delete-account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            await SecureStore.deleteItemAsync('userToken');
            router.replace('/goodbye');
          } else {
            Alert.alert('Error', 'Could not delete account. Try again.');
          }
        } catch (e) {
          Alert.alert('Error', 'Network request failed.');
        }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="dpdp-screen">
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#0f172a" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy &amp; Your Data</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {!policy ? <ActivityIndicator color={Colors.primary} /> : (
          <>
            <Text style={styles.h1}>What we collect</Text>
            {policy.data_collected?.map((d: string, i: number) => (
              <View key={i} style={styles.row}><Ionicons name="ellipse" size={6} color="#888" /><Text style={styles.rowText}>{d}</Text></View>
            ))}
            <Text style={styles.h1}>Your rights</Text>
            {policy.your_rights?.map((d: string, i: number) => (
              <View key={i} style={styles.row}><Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} /><Text style={styles.rowText}>{d}</Text></View>
            ))}
            <Text style={styles.small}>Version {policy.version} · Effective {policy.effective_from}</Text>

            <TouchableOpacity onPress={exportData} disabled={loading} style={styles.btn} testID="dpdp-export">
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Export my data</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteAccount} style={styles.btnDanger} testID="dpdp-delete">
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Delete my account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef0f5' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  container: { padding: 20 },
  h1: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  rowText: { color: '#333', flex: 1, lineHeight: 20 },
  small: { color: '#888', fontSize: 12, marginTop: 16 },
  btn: { flexDirection: 'row', gap: 8, marginTop: 24, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnDanger: { flexDirection: 'row', gap: 8, marginTop: 12, backgroundColor: '#FF3B30', paddingVertical: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

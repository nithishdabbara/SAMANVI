import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function NoticeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Local Hub</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Water supply off 2–5 PM</Text>
        <Text style={styles.subtitle}>Municipal notice · today</Text>
        <Text style={styles.body}>Supply is stopped for pipeline repair. Store water before the shutdown.</Text>
        
        <TouchableOpacity style={styles.btn} onPress={() => {
          import('react-native').then(({ Alert }) => {
            Alert.alert('Reminder Set', 'We will remind you before the shutdown.', [{ text: 'OK', onPress: () => router.back() }]);
          });
        }}>
          <Text style={styles.btnText}>Set reminder</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.push('/')}>
          <Text style={[styles.btnText, { color: Colors.textPrimary }]}>Ask a neighbour</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 16 },
  backButton: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginLeft: 4 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 14 },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22, marginBottom: 24 },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginBottom: 8, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnGhost: { backgroundColor: '#f1f5f9' }
});

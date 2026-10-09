import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function DeclineScreen() {
  const router = useRouter();
  const reasons = ['Already solved', 'Too far for me', 'Prefer another helper', 'Plans changed'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Help Offers</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Tell them why. Your reply is private and polite.</Text>
        {reasons.map((r, i) => (
          <TouchableOpacity key={i} style={styles.row} onPress={() => {
            import('react-native').then(({ Alert }) => {
              Alert.alert('Offer Declined', 'We will politely let them know.', [{ text: 'OK', onPress: () => router.back() }]);
            });
          }}>
            <Text style={styles.rowTitle}>{r}</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginVertical: 8, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginBottom: 8, gap: 12 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary }
});

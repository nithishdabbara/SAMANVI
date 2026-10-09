import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';

export default function GoodbyeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerBox}>
        <Text style={styles.title}>Account deleted</Text>
        <Text style={styles.subtitle}>Your posts, chats and trust score have been removed.</Text>
      </View>
      
      <View style={styles.bottomBox}>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/register')}>
          <Text style={styles.btnText}>Create a new account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => router.replace('/')}>
          <Text style={[styles.btnText, { color: Colors.primary }]}>Back to start</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  centerBox: { alignItems: 'center', marginTop: 90, gap: 10 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  bottomBox: { position: 'absolute', bottom: 44, left: 28, right: 28, gap: 10 },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary }
});

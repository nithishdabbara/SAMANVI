import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function QRScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>QR Check-in</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>The helper scans this code on arrival. It replaces typing the PIN.</Text>
        
        <View style={styles.centerBox}>
          <View style={styles.qrCode}>
            <Image 
              source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CHECKIN_123' }} 
              style={{ width: 186, height: 186 }} 
            />
          </View>
        </View>

        <TouchableOpacity style={styles.btn} onPress={() => {
          Alert.alert('Checked in', 'Helper check-in confirmed', [{ text: 'OK', onPress: () => router.push('/chat/1') }]);
        }}>
          <Text style={styles.btnText}>Simulate helper scan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/chat/1')}>
          <Text style={[styles.btnText, { color: Colors.textPrimary }]}>Use PIN instead</Text>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
  centerBox: { alignItems: 'center', marginBottom: 24 },
  qrCode: { flexDirection: 'row', flexWrap: 'wrap', width: 210, height: 210, backgroundColor: '#fff', borderRadius: 18, padding: 12, alignContent: 'flex-start' },
  qrDot: { width: `${100 / 13}%`, aspectRatio: 1 },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', backgroundColor: Colors.primary },
  btnGhost: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#f1f5f9' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

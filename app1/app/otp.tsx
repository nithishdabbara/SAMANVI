import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function OTPScreen() {
  const router = useRouter();
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Verify Identity</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
          <View style={styles.progressFill} />
          <View style={styles.progressEmpty} />
        </View>
        
        <Text style={styles.title}>Enter the OTP</Text>
        <Text style={styles.subtitle}>Sent by SMS to +91 98•••• ••21.</Text>
        
        <View style={styles.otpRow}>
          <View style={styles.otpBox}><Text style={styles.otpText}>4</Text></View>
          <View style={styles.otpBox}><Text style={styles.otpText}>8</Text></View>
          <View style={styles.otpBox}><Text style={styles.otpText}></Text></View>
          <View style={styles.otpBox}><Text style={styles.otpText}></Text></View>
        </View>
        
        <Text style={styles.resend}>Resend in 0:24</Text>
        
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#5e5ce6" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.infoTitle}>Aadhaar OTP is next</Text>
            <Text style={styles.infoSub}>It goes to this same mobile number.</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.submitBtn} onPress={() => router.push('/verify-aadhaar' as any)}>
          <Text style={styles.submitBtnText}>Verify and continue →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  content: { flex: 1, padding: 20 },
  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressFill: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#0a84ff' },
  progressEmpty: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 24 },
  otpRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  otpBox: { flex: 1, height: 56, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.05, shadowRadius: 8 },
  otpText: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  resend: { fontSize: 14, color: '#64748b', marginBottom: 30 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f2ff', padding: 14, borderRadius: 16, marginBottom: 20 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  infoSub: { fontSize: 13, color: '#64748b' },
  submitBtn: { width: '100%', backgroundColor: '#0a84ff', padding: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});

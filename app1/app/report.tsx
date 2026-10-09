import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ReportScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [details, setDetails] = useState('');
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#0a84ff" />
            <Text style={styles.backText}>Report a User</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.disclaimer}>Admins review every report. The other person is not told who reported.</Text>
          
          {[
            'Spam or fake post',
            'Unsafe behaviour',
            'Asked for money unfairly',
            'Never showed up',
            'Duplicate account'
          ].map((r, i) => (
            <TouchableOpacity key={i} style={styles.row} onPress={() => setSelected(i)}>
              <View style={[styles.dot, { backgroundColor: selected === i ? '#ff453a' : '#e2e8f0' }]} />
              <Text style={styles.rowText}>{r}</Text>
            </TouchableOpacity>
          ))}
          
          <TextInput
            style={styles.input}
            placeholder="Add details (optional)"
            value={details}
            onChangeText={setDetails}
            multiline
          />
          
          <TouchableOpacity style={styles.submitBtn} onPress={() => {
            import('react-native').then(({ Alert }) => {
              Alert.alert('Report Submitted', 'Thank you for your report. Admins will review it shortly.', [{ text: 'OK', onPress: () => router.push('/(tabs)/activity') }]);
            });
          }}>
            <Text style={styles.submitBtnText}>Send report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef0f5' },
  header: { padding: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginLeft: 4 },
  content: { flex: 1, padding: 20 },
  disclaimer: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  input: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, height: 100, fontSize: 15, textAlignVertical: 'top', marginVertical: 14 },
  submitBtn: { width: '100%', backgroundColor: '#ff453a', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 10, shadowColor: '#ff453a', shadowOffset: {width:0,height:8}, shadowOpacity: 0.3, shadowRadius: 20 },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cancelBtn: { width: '100%', backgroundColor: '#f1f5f9', padding: 16, borderRadius: 16, alignItems: 'center' },
  cancelBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '700' }
});

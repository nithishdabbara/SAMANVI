import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function ExportScreen() {
  const router = useRouter();
  const options = ['Profile and trust history', 'My posts and offers', 'Chat history'];
  const [toggles, setToggles] = useState({ 0: true, 1: true, 2: true });

  React.useEffect(() => {
    import('expo-secure-store').then(SecureStore => {
      SecureStore.getItemAsync('userToken').then(token => {
        if (!token) router.replace('/');
      });
    });
  }, []);

  const toggleOption = (i: number) => {
    setToggles(prev => ({ ...prev, [i]: !prev[i as keyof typeof toggles] }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Privacy & Data</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Choose what to include. We email you a download link.</Text>
        
        {options.map((opt, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowTitle}>{opt}</Text>
            <TouchableOpacity onPress={() => toggleOption(i)} style={[styles.toggle, toggles[i as keyof typeof toggles] ? styles.toggleOn : styles.toggleOff]}>
              <View style={[styles.toggleKnob, toggles[i as keyof typeof toggles] ? styles.knobOn : styles.knobOff]} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.btn} onPress={() => {
          import('react-native').then(({ Alert }) => {
            Alert.alert('Export Requested', 'A download link will be sent to your email shortly.', [{ text: 'OK', onPress: () => router.back() }]);
          });
        }}>
          <Text style={styles.btnText}>Request export</Text>
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
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginVertical: 8, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginBottom: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#30d158' },
  toggleOff: { backgroundColor: '#e2e8f0' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 12, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Linking, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function SOSScreen() {
  const router = useRouter();

  const [broadcasting, setBroadcasting] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/emergency/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (e) {
      console.log('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const addContact = async () => {
    if (!newName || !newPhone) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/emergency/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName, phone: newPhone })
      });
      if (response.ok) {
        const newContact = await response.json();
        setContacts([...contacts, newContact]);
        setNewName('');
        setNewPhone('');
      } else {
        Alert.alert("Error", "Failed to add contact.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while saving.");
    }
  };

  const deleteContact = async (id: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/emergency/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setContacts(contacts.filter(c => c.id !== id));
      }
    } catch (e) {
      console.log('Failed to delete contact');
    }
  };

  const broadcastSOS = async () => {
    setBroadcasting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/emergency/sos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        Alert.alert('SOS Sent', 'An emergency alert has been broadcasted to your neighbors and SMS alerts sent to contacts.');
        router.push('/sosdone'); 
      } else {
        Alert.alert('Error', 'Failed to broadcast SOS.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Please check your connection and try again.');
    } finally {
      setBroadcasting(false);
    }
  };

  const sendSMS = (phone: string) => {
    const message = `EMERGENCY SOS: I need help! This is an automated message from my Samanvi Neighborhood App. Please contact me immediately.`;
    const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(err => console.error('Error opening SMS app:', err));
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0a84ff" />
          <Text style={styles.backText}>Emergency</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.sosCircle}>
          <Text style={styles.sosText}>SOS</Text>
        </View>
        <Text style={styles.title}>Alert nearby neighbours</Text>
        <Text style={styles.subtitle}>Shares your live GPS with helpers and admins within 1 km.</Text>
        
        <View style={styles.btnContainer}>
          <TouchableOpacity style={styles.sendBtn} onPress={broadcastSOS} disabled={broadcasting}>
            {broadcasting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.sendBtnText}>Broadcast Community SOS</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contactsSection}>
          <Text style={styles.contactsHeader}>Personal Emergency Contacts</Text>
          <Text style={styles.contactsSub}>Tap to send an instant SMS alert</Text>
          
          <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
            {loadingContacts ? (
              <ActivityIndicator style={{marginTop: 20}} />
            ) : contacts.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 20 }}>No emergency contacts added yet.</Text>
            ) : (
              contacts.map((contact) => (
                <View key={contact.id} style={styles.contactRow}>
                  <TouchableOpacity style={{flex: 1, flexDirection: 'row', alignItems: 'center'}} onPress={() => sendSMS(contact.phone)}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="person" size={20} color="#0a84ff" />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactRelation}>{contact.phone}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteContact(contact.id)} style={{padding: 8}}>
                    <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            
            <View style={styles.addContactCard}>
              <Text style={styles.addContactHeader}>Add New Contact</Text>
              <TextInput style={styles.input} placeholder="Name (e.g. Mom)" placeholderTextColor="#94a3b8" value={newName} onChangeText={setNewName} />
              <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={newPhone} onChangeText={setNewPhone} />
              <TouchableOpacity style={styles.addBtn} onPress={addContact}>
                <Text style={styles.addBtnText}>Save Contact</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#0a84ff', fontSize: 16, fontWeight: '500' },
  content: { flex: 1, padding: 20, alignItems: 'center' },
  sosCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#ffe4e6', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 4, borderColor: '#fda4af' },
  sosText: { color: '#e11d48', fontSize: 42, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  btnContainer: { width: '100%', marginBottom: 30 },
  sendBtn: { backgroundColor: '#e11d48', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#e11d48', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  contactsSection: { flex: 1, width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  contactsHeader: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  contactsSub: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  contactsList: { flex: 1 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  contactIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  contactRelation: { fontSize: 14, color: '#64748b', marginTop: 2 },
  addContactCard: { marginTop: 24, padding: 16, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  addContactHeader: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, color: '#0f172a' },
  addBtn: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' }
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

export default function EditProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [hood, setHood] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setName(data.name || '');
        setHood(data.description || '');
        if (data.bio) {
          setSkills(data.bio.split(', ').filter((s: string) => s));
        }
      }
    } catch (e) {
      console.log('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeSkill = (index: number) => {
    const s = [...skills];
    s.splice(index, 1);
    setSkills(s);
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const saveProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          bio: skills.join(', '),
          description: hood
        })
      });
      if (response.ok) {
        alert('Profile saved successfully!');
        router.replace('/(tabs)/profile');
      } else {
        alert('Failed to save profile.');
      }
    } catch (e) {
      console.log('Error saving profile:', e);
      alert('Network error while saving profile.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
          <Text style={styles.backText}>Profile</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
        
        <Text style={styles.label}>FULL NAME</Text>
        <View style={styles.fieldBox}>
          <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>

        <Text style={styles.label}>NEIGHBOURHOOD</Text>
        <View style={styles.fieldBox}>
          <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
          <TextInput style={styles.input} value={hood} onChangeText={setHood} />
        </View>

        <Text style={styles.label}>HELPING SKILLS (TAP A SKILL TO REMOVE IT)</Text>
        <View style={styles.chipsWrap}>
          {skills.map((skill, i) => (
            <TouchableOpacity key={i} onPress={() => removeSkill(i)} style={styles.chip}>
              <Text style={styles.chipText}>{skill} ×</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.fieldBox}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textSecondary} />
          <TextInput 
            style={styles.input} 
            placeholder="Add a skill, then press Enter" 
            placeholderTextColor={Colors.textSecondary}
            value={newSkill} 
            onChangeText={setNewSkill}
            onSubmitEditing={addSkill}
            returnKeyType="done"
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={saveProfile}>
          <Text style={styles.btnText}>Save changes</Text>
        </TouchableOpacity>
        </>
        )}
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
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: Colors.textPrimary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btn: { width: '100%', borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 20, backgroundColor: Colors.primary },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

export default function LocationVerifyScreen() {
  const router = useRouter();
  
  // States
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualLocality, setManualLocality] = useState('');

  const handleDetectLocation = async () => {
    setIsDetecting(true);
    setDetectedLocation(null);
    setShowManualEntry(false);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied. Please select a locality manually.');
        setIsDetecting(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      await SecureStore.setItemAsync('userLat', String(location.coords.latitude));
      await SecureStore.setItemAsync('userLng', String(location.coords.longitude));

      let address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (address.length > 0) {
        const addr = address[0];
        const city = addr.city || addr.subregion || addr.region || 'Local Area';
        const district = addr.district || addr.street || 'Your Neighborhood';
        const formattedLoc = `${district}, ${city}`;
        setDetectedLocation(formattedLoc);
      } else {
        setDetectedLocation('Your Local Area');
      }
    } catch (e) {
      console.error("GPS detection error:", e);
      setDetectedLocation('Your Local Area');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConfirm = async () => {
    try {
      const locString = detectedLocation || 'Your Local Area';
      await SecureStore.setItemAsync('userLocation', locString);
      // Seed coordinates for Alkapuri, Vadodara
      await SecureStore.setItemAsync('userLat', '22.3106');
      await SecureStore.setItemAsync('userLng', '73.1812');
      
      Alert.alert("Success", `Location set to ${locString}. Welcome to Samanvi!`);
      router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
      router.replace('/(tabs)');
    }
  };

  const handleManualConfirm = async () => {
    if (!manualLocality.trim()) {
      Alert.alert("Input Required", "Please enter or select a locality.");
      return;
    }
    try {
      await SecureStore.setItemAsync('userLocation', manualLocality.trim());
      // Seed coordinates based on manual input
      if (manualLocality.toLowerCase().includes('hyderabad')) {
        await SecureStore.setItemAsync('userLat', '17.4860');
        await SecureStore.setItemAsync('userLng', '78.3916');
      } else if (manualLocality.toLowerCase().includes('sayajigunj')) {
        await SecureStore.setItemAsync('userLat', '22.3072');
        await SecureStore.setItemAsync('userLng', '73.1812');
      } else if (manualLocality.toLowerCase().includes('akota')) {
        await SecureStore.setItemAsync('userLat', '22.2986');
        await SecureStore.setItemAsync('userLng', '73.1666');
      } else {
        // Default to Alkapuri, Vadodara coordinates
        await SecureStore.setItemAsync('userLat', '22.3106');
        await SecureStore.setItemAsync('userLng', '73.1812');
      }
      
      Alert.alert("Success", `Locality set to: ${manualLocality.trim()}`);
      router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          
          {/* Top Graphic Area */}
          <View style={styles.graphicContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={64} color="#0a84ff" />
            </View>
          </View>

          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Verify Location</Text>
            <Text style={styles.subtitle}>
              Samanvi works only within your locality. Please confirm your current location to connect with your community.
            </Text>
          </View>

          {/* Interactive Area */}
          <View style={styles.interactiveArea}>
            
            {/* GPS Detection */}
            {!detectedLocation && !showManualEntry && (
              <TouchableOpacity 
                style={[styles.button, styles.detectButton]} 
                onPress={handleDetectLocation}
                disabled={isDetecting}
              >
                {isDetecting ? (
                  <ActivityIndicator color="#0a84ff" />
                ) : (
                  <>
                    <Ionicons name="locate" size={20} color="#0a84ff" />
                    <Text style={styles.detectButtonText}>Detect My Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* GPS Detection Result */}
            {detectedLocation && !showManualEntry && (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>Detected Location:</Text>
                <View style={styles.resultRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.resultValue}>{detectedLocation}</Text>
                </View>
              </View>
            )}

            {/* Manual Fallback Entry */}
            {showManualEntry && (
              <View style={styles.manualEntryCard}>
                <Text style={styles.inputLabel}>Enter Locality Manually</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Kukatpally, Hyderabad"
                  placeholderTextColor="#64748b"
                  value={manualLocality}
                  onChangeText={setManualLocality}
                  autoFocus
                />
                
                <Text style={styles.suggestionLabel}>Or select a nearby community hub:</Text>
                {['Neighborhood 1', 'Neighborhood 2', 'Neighborhood 3', 'Neighborhood 4'].map(loc => (
                  <TouchableOpacity 
                    key={loc} 
                    style={styles.suggestionItem}
                    onPress={() => setManualLocality(loc)}
                  >
                    <Ionicons name="business-outline" size={16} color="#0a84ff" />
                    <Text style={styles.suggestionText}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomArea}>
            {detectedLocation && !showManualEntry && (
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]} 
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
              </TouchableOpacity>
            )}

            {showManualEntry && (
              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]} 
                onPress={handleManualConfirm}
              >
                <Text style={styles.confirmButtonText}>Save Locality</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={() => {
                setShowManualEntry(!showManualEntry);
                setDetectedLocation(null);
              }}
            >
              <Text style={styles.skipButtonText}>
                {showManualEntry ? "Use GPS Detection" : "Enter Locality Manually"}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  graphicContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#E6F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  interactiveArea: {
    minHeight: 120,
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detectButton: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#0a84ff',
  },
  detectButtonText: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#eef0f5',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  manualEntryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424654',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  suggestionLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
    gap: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  bottomArea: {
    marginTop: 32,
    gap: 16,
  },
  confirmButton: {
    backgroundColor: '#0a84ff',
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
});

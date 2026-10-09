import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker, Callout } from '../../components/MapView';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function ExploreMapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [neighbors, setNeighbors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<any>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(initialRegion);
      fetchNearbyProblems(location.coords.latitude, location.coords.longitude);
    })();
  }, []);

  const fetchNearbyProblems = async (lat: number, lng: number) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems?lat=${lat}&lng=${lng}&radius=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setProblems(data.problems);
      }
      
      const usersRes = await fetch(`${API_BASE_URL}/users/nearby?lat=${lat}&lng=${lng}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersRes.ok) {
        setNeighbors(usersData.users);
      }
    } catch (e) {
      console.log('Error fetching map data:', e);
    } finally {
      setLoading(false);
    }
  };


  const getMarkerColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#EF4444'; // Red
      case 'medium': return '#F59E0B'; // Amber
      default: return '#3B82F6'; // Blue
    }
  };

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
          ref={mapRef}
          provider="google"
          style={styles.map}
          initialCamera={{
            center: { latitude: region.latitude, longitude: region.longitude },
            pitch: 60,
            heading: 0,
            altitude: 1000,
            zoom: 16
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsBuildings={true}
          pitchEnabled={true}
        >
          {problems.map((prob) => (
            <Marker
              key={prob.id}
              coordinate={{
                latitude: Number(prob.latitude),
                longitude: Number(prob.longitude)
              }}
              pinColor={getMarkerColor(prob.priority)}
            >
              <Callout onPress={() => router.push({ pathname: '/problem/[id]', params: { id: prob.id } })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{prob.title}</Text>
                  <Text style={styles.calloutDesc} numberOfLines={2}>{prob.description}</Text>
                  <View style={styles.calloutFooter}>
                    <Text style={styles.calloutBy}>By {prob.author_name}</Text>
                    <Text style={styles.calloutAction}>View Details →</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
          {neighbors.map((user) => (
            <Marker
              key={user.id}
              coordinate={{ latitude: user.lat, longitude: user.lng }}
              pinColor={user.role === 'helper' ? '#34C759' : '#5E5CE6'}
            >
              <Callout onPress={() => router.push('/trust')}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{user.name}</Text>
                  <Text style={styles.calloutDesc}>{user.role}</Text>
                  <View style={styles.calloutFooter}>
                    <Text style={styles.calloutBy}>⭐ {user.trust_score.toFixed(1)} Trust Score</Text>
                    <Text style={styles.calloutAction}>View Profile →</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Initializing Community Map...</Text>
        </View>
      )}

      {/* Map Overlay UI */}
      <View style={styles.overlayTop}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#64748b" />
          <Text style={styles.searchPlaceholder}>Search nearby help requests...</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.myLocationBtn} 
        onPress={() => region && mapRef.current?.animateToRegion(region)}
      >
        <MaterialIcons name="my-location" size={24} color="#0a84ff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.addBtn}
        onPress={() => router.push('/(tabs)/post')}
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef0f5',
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  overlayTop: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  searchPlaceholder: {
    marginLeft: 10,
    color: '#94a3b8',
    fontSize: 14,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtn: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: '#0a84ff',
    padding: 16,
    borderRadius: 35,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  callout: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  calloutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  calloutBy: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  calloutAction: {
    fontSize: 10,
    color: '#0a84ff',
    fontWeight: '700',
  }
});


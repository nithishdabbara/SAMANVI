import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox, Platform } from 'react-native';


import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect } from 'react';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '../constants/Config';
import { Colors } from '../constants/Colors';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web') {
  try {
    (SecureStore as any).setItemAsync = async (key: string, value: string) => {
      localStorage.setItem(key, value);
    };
    (SecureStore as any).getItemAsync = async (key: string) => {
      return localStorage.getItem(key);
    };
    (SecureStore as any).deleteItemAsync = async (key: string) => {
      localStorage.removeItem(key);
    };
  } catch (e) {
    console.error('Failed to polyfill SecureStore on Web:', e);
  }
}



export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const url = Linking.useURL();
  const [fontsLoaded, fontsErr] = useIconFonts();

  useEffect(() => {
    if (fontsLoaded || fontsErr) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsErr]);

  // Location Refresh on App Open (Task 3.6)
  useEffect(() => {
    const refreshLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc) {
            await SecureStore.setItemAsync('userLat', String(loc.coords.latitude));
            await SecureStore.setItemAsync('userLng', String(loc.coords.longitude));
            console.log('Location refreshed on app open:', loc.coords.latitude, loc.coords.longitude);
          }
        }
      } catch (e) {
        console.error('Failed to refresh location on app open:', e);
      }
    };
    refreshLocation();
  }, []);

  // Notification & Referral Deep Linking
  useEffect(() => {
    const handleDeepLink = async (initialUrl: string | null) => {
      if (!initialUrl) return;
      try {
        const parsed = Linking.parse(initialUrl);
        const { path } = parsed;
        
        // Referral link handling (e.g., samanvi://invite/CODE)
        if (path && path.includes('invite/')) {
          const code = path.split('invite/')[1];
          if (code) {
            await SecureStore.setItemAsync('pendingInviteCode', code);
            router.push('/register' as any);
            return;
          }
        }
        
        // Problem link handling
        if (path && path.includes('problem/')) {
          const problemId = path.split('problem/')[1];
          if (problemId) {
            const response = await fetch(`${API_BASE_URL}/problems/${problemId}`);
            if (response.ok) {
              router.push(`/problem/${problemId}` as any);
            } else {
              console.log('Deep link check failed: problem does not exist, redirecting to Home.');
              router.push('/index' as any);
            }
          }
        }
      } catch (err) {
        console.error('Deep link handler error:', err);
      }
    };

    handleDeepLink(url);
  }, [url, router]);

  if (!fontsLoaded && !fontsErr) return null;

  return (
    <>
      <Stack screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        headerShadowVisible: false,
        headerBackTitle: '',
        headerTintColor: Colors.primary,
        contentStyle: { backgroundColor: '#F8FAFC' } // Force light background globally
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="location-verify" options={{ headerShown: false }} />
        
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feed" options={{ headerShown: false }} />
        <Stack.Screen name="editprofile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="verify-aadhaar" options={{ headerShown: false }} />
        <Stack.Screen name="invite" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-dpdp" options={{ headerShown: false }} />
        <Stack.Screen name="problem/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="resolve" options={{ headerShown: false }} />
        <Stack.Screen name="sos" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="hub" options={{ headerShown: false }} />
        <Stack.Screen name="offers" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ headerShown: false }} />
        <Stack.Screen name="trust" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="pay" options={{ headerShown: false }} />
        <Stack.Screen name="report" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="sosdone" options={{ headerShown: false }} />
        <Stack.Screen name="notice" options={{ headerShown: false }} />
        <Stack.Screen name="decline" options={{ headerShown: false }} />
        <Stack.Screen name="export" options={{ headerShown: false }} />
        <Stack.Screen name="goodbye" options={{ headerShown: false }} />
        <Stack.Screen name="invitees" options={{ headerShown: false }} />
        <Stack.Screen name="share" options={{ headerShown: false }} />
        <Stack.Screen name="labs" options={{ headerShown: false }} />
        <Stack.Screen name="voice" options={{ headerShown: false }} />
        <Stack.Screen name="offline" options={{ headerShown: false }} />
        <Stack.Screen name="qr" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}


import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  Animated 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Hyperlocal Co-ordination',
    description: 'Report and discover community issues within walking distance. Bridge the gap between problems and local helpers.',
    icon: 'location-outline',
    color: '#0a84ff',
    bgColor: '#EBF3FB',
  },
  {
    id: 2,
    title: 'Collaborative Solving',
    description: 'Coordinate tasks through secure, real-time messaging. Lend a hand or receive support when it matters most.',
    icon: 'people-outline',
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  {
    id: 3,
    title: 'Trust & Reputation',
    description: 'Earn points and raise your trust score through validated community helps. Secure arrival codes guarantee genuine outcomes.',
    icon: 'shield-checkmark-outline',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setActiveSlide(index);
  };

  const handleNext = async () => {
    if (activeSlide < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (activeSlide + 1) * width,
        animated: true,
      });
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await SecureStore.setItemAsync('hasLaunched', 'true');
      router.replace('/');
    } catch (e) {
      console.error('Error saving onboarding state', e);
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Skip button at top */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleComplete} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Slides */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false, listener: handleScroll }
          )}
          scrollEventThrottle={16}
          style={styles.slidesContainer}
        >
          {slides.map((slide) => (
            <View key={slide.id} style={styles.slideWidth}>
              <View style={styles.slide}>
                <View style={[styles.iconContainer, { backgroundColor: slide.bgColor }]}>
                  <Ionicons name={slide.icon} size={80} color={slide.color} />
                </View>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer controls */}
        <View style={styles.footer}>
          {/* Indicators / Dots */}
          <View style={styles.indicatorContainer}>
            {slides.map((_, index) => {
              const dotWidth = scrollX.interpolate({
                inputRange: [
                  (index - 1) * width,
                  index * width,
                  (index + 1) * width,
                ],
                outputRange: [8, 20, 8],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange: [
                  (index - 1) * width,
                  index * width,
                  (index + 1) * width,
                ],
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      width: dotWidth,
                      opacity,
                      backgroundColor: slides[activeSlide]?.color || '#0a84ff',
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            style={[
              styles.button, 
              { backgroundColor: slides[activeSlide]?.color || '#0a84ff' }
            ]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {activeSlide === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons 
              name={activeSlide === slides.length - 1 ? 'checkmark' : 'arrow-forward'} 
              size={18} 
              color="#FFF" 
              style={{ marginLeft: 6 }} 
            />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    height: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  slidesContainer: {
    flex: 1,
  },
  slideWidth: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  iconContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 32,
  },
  indicatorContainer: {
    flexDirection: 'row',
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

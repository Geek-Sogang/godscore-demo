/**
 * app/_layout.tsx
 * 루트 레이아웃 — Hana2.0 + Paperlogy 폰트 로딩 + NavigationContainer
 * 
 * [긴급 수정] useAuthStore.initialize() 무한 루프 방지를 위해 useEffect 도입
 */
import '../global.css';
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { useAuthStore } from '../src/application/stores/authStore';

export default function RootLayout() {
  const initializeAuth = useAuthStore(s => s.initialize);
  
  // [수정] 앱 기동 시 딱 한 번만 Auth 초기화 실행 (무한 루프 차단)
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Hana2.0 OTF + Paperlogy TTF 폰트 등록
  const [fontsLoaded] = useFonts({
    // Hana2.0 패밀리
    'Hana2-Light':   require('../assets/fonts/Hana2-Light.otf'),
    'Hana2-Regular': require('../assets/fonts/Hana2-Regular.otf'),
    'Hana2-Medium':  require('../assets/fonts/Hana2-Medium.otf'),
    'Hana2-Bold':    require('../assets/fonts/Hana2-Bold.otf'),
    'Hana2-Heavy':   require('../assets/fonts/Hana2-Heavy.otf'),
    'Hana2-CM':      require('../assets/fonts/Hana2-CM.otf'),
    // Paperlogy 패밀리 (Figma 디자인 적용)
    'Paperlogy-Regular':  require('../assets/fonts/Paperlogy-4Regular.ttf'),
    'Paperlogy-Medium':   require('../assets/fonts/Paperlogy-5Medium.ttf'),
    'Paperlogy-SemiBold': require('../assets/fonts/Paperlogy-6SemiBold.ttf'),
    'Paperlogy-Bold':     require('../assets/fonts/Paperlogy-7Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f2ed', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#006b58', fontSize: 16 }}>하나 더</Text>
      </View>
    );
  }

  return <Slot />;
}

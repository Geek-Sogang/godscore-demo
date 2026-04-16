/**
 * app/index.tsx
 * Expo Router 진입점
 * Figma 매칭: [스플래시 → 홈 진입]
 *
 * [수정] global.css import 제거 — _layout.tsx에서만 1회 import (NativeWind 중복 방지)
 */
import React from 'react';
import AppNavigator from '../src/presentation/navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}

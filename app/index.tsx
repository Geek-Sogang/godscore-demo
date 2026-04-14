/**
 * app/index.tsx
 * Expo Router 진입점
 * Figma 매칭: [스플래시 → 홈 진입]
 */
import '../global.css';
import React from 'react';
import AppNavigator from '../src/presentation/navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}

/**
 * app/_layout.tsx
 * expo-router 루트 레이아웃
 * NavigationContainer는 expo-router가 자동 제공 → 별도 선언 불필요
 */
import '../global.css';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}

/**
 * src/presentation/navigation/AppNavigator.tsx
 * 앱 네비게이션 스택
 * Figma 화면 전환 구조 대응
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeDashboard from '../screens/HomeDashboard';
import MissionCenter from '../screens/MissionCenter';
import CreditScoreDetail from '../screens/CreditScoreDetail';

// ── 전체 화면 파라미터 타입 (타입 안전 네비게이션) ──────────
export type RootStackParamList = {
  HomeDashboard: undefined;
  MissionCenter: undefined;
  CreditScoreDetail: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="HomeDashboard">
        {/* Figma 매칭: [메인보드 / 홈 대시보드] */}
        <Stack.Screen
          name="HomeDashboard"
          component={HomeDashboard}
          options={{ title: '하나 더 — 홈' }}
        />
        {/* Figma 매칭: [미션 센터] */}
        <Stack.Screen
          name="MissionCenter"
          component={MissionCenter}
          options={{ title: '미션 센터' }}
        />
        {/* Figma 매칭: [대출/신용 리포트] */}
        <Stack.Screen
          name="CreditScoreDetail"
          component={CreditScoreDetail}
          options={{ title: '신용점수 상세' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

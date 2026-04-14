// Figma 매칭: [전체 네비게이션 구조]
/**
 * AppNavigator.tsx
 * Bottom Tab 네비게이터 + Stack 네비게이터 통합
 *
 * ⚠️ NavigationContainer 제거:
 *    expo-router("main": "expo-router/entry")가 최상위 NavigationContainer를 자동 제공.
 *    여기에 또 추가하면 "Another NavigationContainer" 에러 → 웹 렌더링 실패.
 *
 * 탭 구성: 홈 | 미션 | 스토어 | 리포트 | 내 정보
 */

import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ── 화면 Import ───────────────────────────────────────────────────
import HomeScreen            from '../screens/HomeScreen';
import MissionCenterScreen   from '../screens/MissionCenterScreen';
import MissionUploadScreen   from '../screens/MissionUploadScreen';
import ItemStoreScreen       from '../screens/ItemStoreScreen';
import FinanceReportScreen   from '../screens/FinanceReportScreen';

// ── 타입 정의 ─────────────────────────────────────────────────────
export type RootTabParamList = {
  Home:          undefined;
  MissionCenter: undefined;
  ItemStore:     undefined;
  FinanceReport: undefined;
  MyPage:        undefined;
};

export type HomeStackParamList = {
  HomeDashboard: undefined;
  MissionCenter: undefined;
  MissionUpload: { missionId: string };
};

const Tab   = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// ── 탭 아이콘 ──────────────────────────────────────────────────────
function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string;
  label: string;
  focused: boolean;
  color?: string;
}) {
  return (
    <View className="items-center pt-1">
      <Text style={{ fontSize: focused ? 24 : 20 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '400',
          color: focused ? '#00A651' : '#9CA3AF',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── MyPage 플레이스홀더 ──────────────────────────────────────────
function MyPageScreen() {
  return (
    <View className="flex-1 bg-hana-cream items-center justify-center">
      <Text className="text-4xl mb-3">👤</Text>
      <Text className="text-lg font-bold text-gray-700">내 정보</Text>
      <Text className="text-sm text-gray-400 mt-1">프로필 · 설정 · 도움말</Text>
    </View>
  );
}

// ── 홈 스택 (HomeScreen → MissionUpload 딥링크 포함) ──────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeDashboard" component={HomeScreen} />
      <Stack.Screen name="MissionCenter" component={MissionCenterScreen} />
      <Stack.Screen
        name="MissionUpload"
        component={MissionUploadScreen}
        options={{
          headerShown: true,
          headerTitle: '미션 인증',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerBackTitle: '',
          headerTintColor: '#00A651',
        }}
      />
    </Stack.Navigator>
  );
}

// ── 메인 탭 네비게이터 (NavigationContainer 없음 — expo-router가 제공) ──
export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
          paddingTop: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="홈" focused={focused} color="#00A651" />
          ),
        }}
      />
      <Tab.Screen
        name="MissionCenter"
        component={MissionCenterScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚡" label="미션" focused={focused} color="#00A651" />
          ),
        }}
      />
      <Tab.Screen
        name="ItemStore"
        component={ItemStoreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🛒" label="스토어" focused={focused} color="#00A651" />
          ),
          tabBarBadge: 'NEW',
          tabBarBadgeStyle: {
            backgroundColor: '#F5A623',
            color: 'white',
            fontSize: 8,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="FinanceReport"
        component={FinanceReportScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="리포트" focused={focused} color="#00A651" />
          ),
        }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="내 정보" focused={focused} color="#00A651" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

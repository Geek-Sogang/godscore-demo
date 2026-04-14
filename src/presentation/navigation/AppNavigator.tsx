// Figma 매칭: [전체 네비게이션 구조]
/**
 * AppNavigator.tsx
 * Bottom Tab 네비게이터 + Stack 네비게이터 통합
 *
 * [수정] MissionCenter 탭도 Stack으로 감쌈
 *   이전: Tab.Screen에 MissionCenterScreen 직접 연결
 *         → navigation prop 없어서 MissionUploadScreen으로 이동 불가
 *   이후: MissionStack (MissionCenterMain → MissionUpload) 으로 감쌈
 *         → navigation.navigate('MissionUpload', { missionId }) 가능
 */

import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen            from '../screens/HomeScreen';
import MissionCenterScreen   from '../screens/MissionCenterScreen';
import MissionUploadScreen   from '../screens/MissionUploadScreen';
import ItemStoreScreen       from '../screens/ItemStoreScreen';
import FinanceReportScreen   from '../screens/FinanceReportScreen';

// ── 타입 정의 ─────────────────────────────────────────────────────
export type RootTabParamList = {
  Home:          undefined;
  Mission:       undefined;
  ItemStore:     undefined;
  FinanceReport: undefined;
  MyPage:        undefined;
};

// 홈 스택 (홈 → 미션센터 → 미션업로드)
export type HomeStackParamList = {
  HomeDashboard: undefined;
  MissionCenter: undefined;
  MissionUpload: { missionId: string };
};

// 미션 스택 (미션센터 → 미션업로드)
export type MissionStackParamList = {
  MissionCenterMain: undefined;
  MissionUpload:     { missionId: string };
};

const Tab          = createBottomTabNavigator<RootTabParamList>();
const HomeStack    = createNativeStackNavigator<HomeStackParamList>();
const MissionStack = createNativeStackNavigator<MissionStackParamList>();

// ── 탭 아이콘 ──────────────────────────────────────────────────────
function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View className="items-center pt-1">
      <Text style={{ fontSize: focused ? 24 : 20 }}>{emoji}</Text>
      <Text style={{
        fontSize: 10,
        fontWeight: focused ? '700' : '400',
        color: focused ? '#00A651' : '#9CA3AF',
        marginTop: 2,
      }}>
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

const UPLOAD_HEADER = {
  headerShown:        true,
  headerTitle:        '미션 인증',
  headerTitleStyle:   { fontWeight: '700' as const, fontSize: 16 },
  headerBackTitle:    '',
  headerTintColor:    '#00A651',
};

// ── 홈 스택 ───────────────────────────────────────────────────────
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeDashboard" component={HomeScreen} />
      <HomeStack.Screen name="MissionCenter" component={MissionCenterScreen} />
      <HomeStack.Screen name="MissionUpload" component={MissionUploadScreen} options={UPLOAD_HEADER} />
    </HomeStack.Navigator>
  );
}

// ── 미션 스택 (탭에서 바로 미션 업로드로 진입 가능) ─────────────
function MissionStackNavigator() {
  return (
    <MissionStack.Navigator screenOptions={{ headerShown: false }}>
      <MissionStack.Screen name="MissionCenterMain" component={MissionCenterScreen} />
      <MissionStack.Screen name="MissionUpload" component={MissionUploadScreen} options={UPLOAD_HEADER} />
    </MissionStack.Navigator>
  );
}

// ── 메인 탭 네비게이터 ────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor:  '#F3F4F6',
          borderTopWidth:  1,
          height:          72,
          paddingBottom:   8,
          paddingTop:      4,
          shadowColor:     '#000',
          shadowOffset:    { width: 0, height: -2 },
          shadowOpacity:   0.06,
          shadowRadius:    8,
          elevation:       8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="홈" focused={focused} /> }}
      />
      <Tab.Screen
        name="Mission"
        component={MissionStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" label="미션" focused={focused} /> }}
      />
      <Tab.Screen
        name="ItemStore"
        component={ItemStoreScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="스토어" focused={focused} />,
          tabBarBadge: 'NEW',
          tabBarBadgeStyle: { backgroundColor: '#F5A623', color: 'white', fontSize: 8, fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="FinanceReport"
        component={FinanceReportScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="리포트" focused={focused} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="내 정보" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

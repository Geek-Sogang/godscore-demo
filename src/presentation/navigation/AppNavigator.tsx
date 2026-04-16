// Figma 매칭: [전체 네비게이션 구조]
/**
 * AppNavigator.tsx
 * Bottom Tab 네비게이터 + Stack 네비게이터 통합
 *
 * [수정] MissionCenter 탭도 Stack으로 감쌈
 *   이전: Tab.Screen에 MissionCenterScreen 직접 연결
 *   이후: MissionStack (MissionCenterMain → MissionUpload) 으로 감쌈
 *
 * [추가] ProfileScreen 연동 (MyPage 플레이스홀더 제거)
 */

import React from 'react';
import { View, Text, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen            from '../screens/HomeScreen';
import MissionCenterScreen   from '../screens/MissionCenterScreen';
import MissionUploadScreen   from '../screens/MissionUploadScreen';
import ItemStoreScreen       from '../screens/ItemStoreScreen';
import FinanceReportScreen   from '../screens/FinanceReportScreen';
import ProfileScreen          from '../screens/ProfileScreen';

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

// ── Figma 탭 아이콘 이미지 (node 1:498 기준) ─────────────────────
const TAB_ICONS = {
  home:    { uri: 'https://www.figma.com/api/mcp/asset/65be0bd9-0e29-453d-8d85-abc4edc80c72' },
  mission: { uri: 'https://www.figma.com/api/mcp/asset/02e1eca6-3742-4239-85dd-85451ca03112' },
  store:   { uri: 'https://www.figma.com/api/mcp/asset/e36502f6-6864-4b9b-a39e-a91e1412460b' },
  report:  { uri: 'https://www.figma.com/api/mcp/asset/9535487f-bae4-4684-95ed-bfb1956c6d1a' },
  myinfo:  { uri: 'https://www.figma.com/api/mcp/asset/8626bda8-2ea5-4039-80c9-c0f020b0354c' },
};

function TabIcon({ icon, label, focused }: { icon: { uri: string }; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Image
        source={icon}
        style={{
          width: 24, height: 24,
          tintColor: focused ? '#006b58' : '#9CA3AF',
        }}
        resizeMode="contain"
      />
      <Text style={{
        fontSize: 10,
        fontWeight: focused ? '700' : '400',
        color: focused ? '#006b58' : '#9CA3AF',
        marginTop: 2,
      }}>
        {label}
      </Text>
    </View>
  );
}

const UPLOAD_HEADER = {
  headerShown:        true,
  headerTitle:        '미션 인증',
  headerTitleStyle:   { fontWeight: '700' as const, fontSize: 16 },
  headerBackTitle:    '',
  headerTintColor:    '#006b58',
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
          backgroundColor: 'rgba(252,249,244,0.97)',
          borderTopColor:  'transparent',
          borderTopWidth:  0,
          height:          72,
          paddingBottom:   8,
          paddingTop:      8,
          shadowColor:     '#1c1c19',
          shadowOffset:    { width: 0, height: -4 },
          shadowOpacity:   0.04,
          shadowRadius:    24,
          elevation:       8,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon={TAB_ICONS.home} label="홈" focused={focused} /> }}
      />
      <Tab.Screen
        name="Mission"
        component={MissionStackNavigator}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon={TAB_ICONS.mission} label="미션" focused={focused} /> }}
      />
      <Tab.Screen
        name="ItemStore"
        component={ItemStoreScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon={TAB_ICONS.store} label="스토어" focused={focused} />,
          tabBarBadge: 'NEW',
          tabBarBadgeStyle: { backgroundColor: '#F5A623', color: 'white', fontSize: 8, fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="FinanceReport"
        component={FinanceReportScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon={TAB_ICONS.report} label="리포트" focused={focused} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon={TAB_ICONS.myinfo} label="내 정보" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

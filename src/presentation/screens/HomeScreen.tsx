// Figma 매칭: [메인 — 1:498]
/**
 * HomeScreen.tsx — Figma 100% 반영 + 에셋 URL 갱신 (2026-04-16)
 * 모든 이미지 에셋은 Figma MCP에서 최신 URL 사용 (7일 유효)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { HomeStackParamList, RootTabParamList } from '../navigation/AppNavigator';
import { useGodScoreStore } from '../../application/stores/godScoreStore';
import { useMissionStore } from '../../application/stores/missionStore';

// ── 화면 크기 기반 스케일링 ────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const S = (n: number): number => Math.round((SCREEN_W / 390) * n);

// ── Figma 에셋 (node 1:498, 최신 URL) ─────────────────────────
const IMG = {
  // 헤더
  border:      { uri: 'https://www.figma.com/api/mcp/asset/096d05cd-4f55-481e-926b-6feb57561d60' },
  coin:        require('../../../assets/images/coin.png'),
  // 작업실
  room:        { uri: 'https://www.figma.com/api/mcp/asset/80ef3383-73fe-49c3-bbd8-9f2ae86bacd9' },
  // 로컬 PNG 아이콘
  shopIcon:    require('../../../assets/images/shop_icon.png'),
  messageIcon: require('../../../assets/images/message_icon.png'),
  missionIcon: require('../../../assets/images/mission_icon.png'),
  // 알림 뱃지 (숫자 5)
  badge:       { uri: 'https://www.figma.com/api/mcp/asset/a57dc93e-40ee-4f57-946a-2ddc1e2b6294' },
} as const;

// ── 카테고리 ──────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'A', label: '생활',    bg: 'rgba(255,217,119,0.24)' },
  { id: 'B', label: '일•소득', bg: '#d7e6f1' },
  { id: 'C', label: '소비',    bg: '#e3def5' },
  { id: 'D', label: 'ESG',    bg: '#cfe4d0' },
];

// ── Today's QUEST ─────────────────────────────────────────────
const QUESTS = [
  { id: 'A_1', label: '⏰ 오전 7시 기상 인증',  points: 50 },
  { id: 'B_4', label: '💼 오늘 업무 인증 완료', points: 50 },
  { id: 'C_3', label: '🛒 식료품 구매 인증',    points: 50 },
  { id: 'D_3', label: '♻️ 에너지 절약 미션',   points: 50 },
];

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;
type TabNav  = BottomTabNavigationProp<RootTabParamList>;

export default function HomeScreen(): React.JSX.Element {
  const navigation       = useNavigation<HomeNav>();
  const { currentSnapshot }                    = useGodScoreStore();
  const { dailyStatus, pointBalance, streak }  = useMissionStore();

  const score       = currentSnapshot?.breakdown.totalScore ?? 437;
  // 코인 잔고는 missionStore의 pointBalance (DB 연동) 에서 직접 읽음
  const coins       = pointBalance;
  const streakCount = streak?.currentStreak ?? 64;
  const completedToday = dailyStatus?.completedCount ?? 0;
  const totalToday     = dailyStatus?.totalCount ?? 16;

  const tierLabel = (s: number): string => {
    if (s < 400) return '새싹';
    if (s < 600) return '성실';
    if (s < 850) return '갓생';
    return '레전드';
  };

  const catCompleted = (catId: string): number => {
    if (!dailyStatus?.missions) return 0;
    return ['1','2','3','4'].filter(n =>
      dailyStatus.missions[`${catId}_${n}` as keyof typeof dailyStatus.missions] === true
    ).length;
  };

  // 탭 네비게이터(부모)를 통해 Mission 탭으로 전환 → 미션 아이콘이 초록색으로 변경됨
  const goMission = useCallback(() => {
    const tabNav = navigation.getParent<TabNav>();
    if (tabNav) {
      tabNav.navigate('Mission');
    }
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f2ed' }}>

      {/* ── 헤더 (Figma h:64px, px:24px) ───────────────────────── */}
      <View style={{
        height: 64,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24,
        backgroundColor: 'rgba(252,249,244,0.7)',
        shadowColor: '#1c1c19', shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.06, shadowRadius: 48,
      }}>
        {/* 좌측: 아바타(40px) + 앱명(18px) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
          <Image
            source={IMG.border}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          <Text style={{ fontFamily: 'Hana2-Medium', color: '#006b58', fontSize: 18, letterSpacing: -0.45 }}>
            하나 더
          </Text>
        </View>

        {/* 우측: 코인 (Figma 그리드: pill 63×19 + 코인 24×25 + 숫자) */}
        <View style={{ width: 63, height: 27 }}>
          {/* 반투명 배경 pill: top 4, h 19 */}
          <View style={{
            position: 'absolute', top: 4, left: 0, right: 0, height: 19,
            backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 7,
          }} />
          {/* 코인 이미지(좌) + 숫자(우) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 27 }}>
            <Image source={IMG.coin} style={{ width: 24, height: 25 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: 13, marginLeft: 2 }}>
              {coins}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S(40) }}>

        {/* ── 갓생점수 원형 ────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginTop: S(24) }}>
          <View style={{
            backgroundColor: 'white', borderRadius: S(90),
            width: S(180), height: S(180),
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#006b58',
            shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.23, shadowRadius: 4,
          }}>
            {/* 등급 뱃지 */}
            <View style={{
              backgroundColor: 'rgba(138,138,138,0.2)', borderRadius: S(7),
              paddingHorizontal: S(6), paddingVertical: S(2), marginBottom: S(6),
            }}>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(11) }}>
                {tierLabel(score)}
              </Text>
            </View>
            {/* 점수 */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: 'Hana2-Heavy', color: '#006b58', fontSize: S(36), lineHeight: S(42) }}>
                {score}
              </Text>
              <Text style={{ fontFamily: 'Hana2-CM', color: '#383835', fontSize: S(24), marginLeft: S(1) }}>
                점
              </Text>
            </View>
            {/* 연속 달성 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S(4) }}>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#ba3200', fontSize: S(13) }}>
                {streakCount}일{' '}
              </Text>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#383835', fontSize: S(11) }}>
                연속 달성 중🔥
              </Text>
            </View>
          </View>
        </View>

        {/* ── 카테고리 박스 ─────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: S(10), paddingHorizontal: S(18), marginTop: S(20) }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat.id} onPress={goMission} style={{
              flex: 1, height: S(70), borderRadius: S(14),
              backgroundColor: cat.bg,
              shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: S(14) }}>
                {cat.label}
              </Text>
              <Text style={{ fontFamily: 'Hana2-Heavy', color: '#ba3200', fontSize: S(13), marginTop: S(4) }}>
                {catCompleted(cat.id)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 작업실 프리뷰 ─────────────────────────────────── */}
        <View style={{ marginHorizontal: S(11), marginTop: S(20) }}>
          {/* 구분선 + 작업실 이름 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S(10) }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} />
            <View style={{ marginHorizontal: S(10), alignItems: 'center' }}>
              <Text style={{ fontSize: S(14) }}>🏠</Text>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#000', fontSize: S(13) }}>민영이의 작업실</Text>
            </View>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} />
          </View>

          {/* 방 이미지 컨테이너 */}
          <View style={{
            aspectRatio: 389 / 392, borderRadius: S(31), overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
          }}>
            <Image source={IMG.room} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

            {/* SHOP 버튼 — flexbox column: SHOP텍스트 위 + 카트아이콘 아래 */}
            <TouchableOpacity onPress={goMission} style={{
              position: 'absolute', right: S(8), top: S(8),
              width: S(58), height: S(59),
              backgroundColor: 'rgba(0,107,88,0.13)', borderRadius: S(7),
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              paddingTop: S(2), paddingBottom: S(4),
            }}>
              <Text style={{
                fontFamily: 'Paperlogy-Bold', fontSize: S(11), color: '#383835',
                marginBottom: S(2),
              }}>SHOP</Text>
              <Image
                source={IMG.shopIcon}
                style={{ width: S(32), height: S(32) }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            {/* 메시지 버튼 — 원형 배경 + 말풍선 아이콘 */}
            <View style={{
              position: 'absolute', right: S(8), top: S(76),
              width: S(58), height: S(58),
              backgroundColor: 'rgba(133,209,222,0.32)', borderRadius: S(29),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Image source={IMG.messageIcon} style={{ width: S(34), height: S(34) }} resizeMode="contain" />
              {/* 알림 뱃지 */}
              <Image source={IMG.badge} style={{
                position: 'absolute', top: S(-2), right: S(-2), width: S(17), height: S(17),
              }} resizeMode="contain" />
            </View>
          </View>
        </View>

        {/* ── Today's QUEST 카드 ─────────────────────────────── */}
        <View style={{
          marginHorizontal: S(11), marginTop: S(16),
          backgroundColor: 'white', borderRadius: S(18),
          paddingTop: S(13), paddingBottom: S(15), paddingHorizontal: S(4),
          shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4,
        }}>
          {/* 상단: 아이콘 + 타이틀 + 코인 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S(8), marginBottom: S(6) }}>
            {/* Today's QUEST 아이콘 — mission_icon.png (파란 문서) */}
            <Image source={IMG.missionIcon} style={{ width: S(50), height: S(42) }} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: S(4) }}>
              <View style={{
                backgroundColor: 'rgba(0,107,88,0.15)', borderRadius: S(7),
                paddingHorizontal: S(8), paddingVertical: S(2), alignSelf: 'flex-start',
              }}>
                <Text style={{ fontFamily: 'Paperlogy-Bold', color: '#383835', fontSize: S(11) }}>
                  Today's QUEST
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={IMG.coin} style={{ width: S(24), height: S(25) }} resizeMode="contain" />
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#3971e0', fontSize: S(10), marginLeft: S(2) }}>
                0/800
              </Text>
            </View>
          </View>

          {/* 진행률 바 */}
          <View style={{ paddingHorizontal: S(18), marginBottom: S(6) }}>
            <View style={{ backgroundColor: '#cecece', height: S(3), borderRadius: S(5) }}>
              {completedToday > 0 && (
                <View style={{
                  height: '100%', borderRadius: S(5), backgroundColor: '#006b58',
                  width: ((completedToday / totalToday) * 100 + '%') as `${number}%`,
                }} />
              )}
            </View>
            <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#383835', fontSize: S(8), textAlign: 'right', marginTop: S(2) }}>
              {completedToday}/{totalToday} 완료
            </Text>
          </View>

          {/* 퀘스트 리스트 */}
          <View style={{ gap: S(5), paddingHorizontal: S(12) }}>
            {QUESTS.map((q) => {
              const done = dailyStatus?.missions[q.id as keyof typeof dailyStatus.missions] === true;
              return (
                <TouchableOpacity key={q.id} onPress={goMission} style={{
                  height: S(32), borderRadius: S(10),
                  borderWidth: 1, borderColor: 'rgba(0,103,173,0.15)',
                  flexDirection: 'row', alignItems: 'center', paddingHorizontal: S(8),
                  backgroundColor: done ? 'rgba(0,107,88,0.05)' : 'white',
                }}>
                  {/* 체크박스 */}
                  <View style={{
                    width: S(18), height: S(18), borderRadius: S(4),
                    backgroundColor: done ? '#006b58' : '#d2e0ff',
                    marginRight: S(6), alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done && <Text style={{ color: 'white', fontSize: S(10) }}>✓</Text>}
                  </View>
                  <Text style={{
                    fontFamily: 'Paperlogy-Regular', color: '#383835', fontSize: S(12), flex: 1,
                  }}>
                    {q.label}
                  </Text>
                  {/* 코인 보상 */}
                  <Image source={IMG.coin} style={{ width: S(24), height: S(25) }} resizeMode="contain" />
                  <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#3971e0', fontSize: S(10), marginLeft: S(2) }}>
                    +{q.points}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 미션 센터 이동 버튼 ──────────────────────────── */}
        <View style={{ alignItems: 'center', marginTop: S(16) }}>
          <TouchableOpacity onPress={goMission} style={{
            backgroundColor: 'rgba(255,217,119,0.24)',
            borderRadius: S(20), height: S(29), width: S(195),
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
          }}>
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#c6a244', fontSize: S(15) }}>
              미션 센터에서 인증하기 →
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

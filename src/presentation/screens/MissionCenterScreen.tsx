// Figma 매칭: [미션센터-생활루틴 — 16:1104]
/**
 * MissionCenterScreen.tsx — Figma 100% 리디자인 (2026-04-16)
 *
 * 구성:
 *  1. 헤더: 아바타 + 하나 더 + 코인 (HomeScreen과 동일)
 *  2. 날짜/타이틀: 미션 센터 + 날짜 + 오늘 마감 타이머
 *  3. 카테고리 요약 박스 4개 (탭 역할)
 *  4. 선택된 카테고리 배너 (배경색 + 진행바 + 미션 태그)
 *  5. 미션 카드 4개 (아이콘 + 텍스트 + 인증 버튼)
 *  6. 달성률 한 눈에 보기 (원형 진행 차트)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMissionStore } from '../../application/stores/missionStore';
import { useAuthStore } from '../../application/stores/authStore';
import type { MissionFeatureId } from '../../../types/features';
import MissionInputModal from './MissionInputModal';
import type { MissionStackParamList } from '../navigation/AppNavigator';

// ── 화면 크기 기반 스케일링 ─────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const BASE_W = 390; // Figma 기준 너비
const S = (n: number): number => Math.round((Math.min(SCREEN_W, 480) / BASE_W) * n);

type MissionNavProp = NativeStackNavigationProp<MissionStackParamList, 'MissionCenterMain'>;

// ── 파일 업로드 미션 목록 ──────────────────────────────────────
const FILE_UPLOAD_MISSIONS: ReadonlySet<string> = new Set(['B_1', 'B_4', 'D_3', 'D_4']);

// ── Figma 이미지 에셋 (node 16:1104) ──────────────────────────
const IMG = {
  coin:    require('../../../assets/images/coin.png'),
  border:  { uri: 'https://www.figma.com/api/mcp/asset/096d05cd-4f55-481e-926b-6feb57561d60' },
  // 생활 카테고리 미션 아이콘
  iconA1:  { uri: 'https://www.figma.com/api/mcp/asset/828c381d-992f-4f94-8751-100f48feb06e' },
  iconA2:  { uri: 'https://www.figma.com/api/mcp/asset/16386670-9500-4f6f-8ddb-3e5e7fed9580' },
  iconA3:  { uri: 'https://www.figma.com/api/mcp/asset/2b7a45f9-8880-4740-a7dd-3df6c91ebbfe' },
  iconA4:  { uri: 'https://www.figma.com/api/mcp/asset/2b171a06-4ba7-4942-b809-f12435819ca5' },
  // 달성률 원형 차트
  circBg:  { uri: 'https://www.figma.com/api/mcp/asset/371cfd06-b48a-4377-8dc0-fa1347493f8d' },
  circA:   { uri: 'https://www.figma.com/api/mcp/asset/710a08b9-0173-4777-9c9d-7c993229bffa' },
  circB:   { uri: 'https://www.figma.com/api/mcp/asset/3f709264-04cc-41d2-aa26-83a4bd9783aa' },
  circC:   { uri: 'https://www.figma.com/api/mcp/asset/0793efbc-ac0b-4dbd-9951-8e18afa9ba7b' },
  circD:   { uri: 'https://www.figma.com/api/mcp/asset/5a404cf9-0cb8-43d0-8df0-76f0fcd7002f' },
  // 로컬 PNG (assets/images/ 폴더에 파일 넣으면 자동 표시)
  missionIcon: require('../../../assets/images/mission_icon.png'),
  messageIcon: require('../../../assets/images/message_icon.png'),
  shopIcon:    require('../../../assets/images/shop_icon.png'),
} as const;

// ── 카테고리 메타 ─────────────────────────────────────────────
type CatId = 'A' | 'B' | 'C' | 'D';

interface CategoryMeta {
  label:       string;
  title:       string;
  subtitle:    string;
  bannerBg:    string;
  progressBg:  string;
  progressFill:string;
  progressColor:string;
  textColor:   string;
  pieBg:       string;   // 파이차트 배경색 (밝은 카테고리 컬러)
  tags:        string[];
}

const CATEGORIES: Record<CatId, CategoryMeta> = {
  A: {
    label:        '생활',
    title:        '생활 루틴',
    subtitle:     '규칙적인 생활을 인증해보세요.',
    bannerBg:     'rgba(254,231,75,0.31)',
    progressBg:   'rgba(255,255,255,0.7)',
    progressFill: '#d9c267',
    progressColor:'#d9c267',
    textColor:    '#c6a244',
    pieBg:       'rgba(254,231,75,0.25)',  // 생활: 연노랑
    tags:         ['기상 인증', '수면 규칙성', '출석 체크', '미션 달성'],
  },
  B: {
    label:        '일•소득',
    title:        '일 · 소득',
    subtitle:     '업무 활동을 인증해보세요.',
    bannerBg:     'rgba(215,230,241,0.8)',
    progressBg:   'rgba(255,255,255,0.7)',
    progressFill: '#5f9ecb',
    progressColor:'#5f9ecb',
    textColor:    '#5f9ecb',
    pieBg:       'rgba(215,230,241,0.7)',  // 일소득: 연파랑
    tags:         ['포트폴리오', '월 수입', '수입 안정성', '업무 완료'],
  },
  C: {
    label:        '소비',
    title:        '소비 행동',
    subtitle:     '건강한 소비 습관을 기록하세요.',
    bannerBg:     'rgba(227,222,245,0.8)',
    progressBg:   'rgba(255,255,255,0.7)',
    progressFill: '#9b8ec4',
    progressColor:'#9b8ec4',
    textColor:    '#766aa1',
    pieBg:       'rgba(227,222,245,0.7)',  // 소비: 연보라
    tags:         ['소비 패턴', '새벽 충동', '식료품', '잔고 유지'],
  },
  D: {
    label:        'ESG',
    title:        '개인 ESG',
    subtitle:     'ESG 생활 습관을 실천하세요.',
    bannerBg:     'rgba(207,228,208,0.7)',
    progressBg:   'rgba(255,255,255,0.7)',
    progressFill: '#407f43',
    progressColor:'#407f43',
    textColor:    '#407f43',
    pieBg:       'rgba(207,228,208,0.7)',  // ESG: 연초록
    tags:         ['운동•자기관리', '대중교통', '에너지 절약', '봉사•기부'],
  },
};

// ── 카테고리별 미션 정의 ───────────────────────────────────────
interface MissionDef {
  id:    MissionFeatureId;
  title: string;
  desc:  string;
  icon?: { uri: string };
  emoji?: string;
  reward:number;
}

const MISSIONS: Record<CatId, MissionDef[]> = {
  A: [
    { id: 'A_1', title: '기상 인증',   desc: '목표 기상 시각 ± 30분 이내에\n기상을 인증하세요.', icon: IMG.iconA1, reward: 50 },
    { id: 'A_2', title: '수면 규칙성', desc: '6~9시간 수면 후\n수면 데이터를 동기화하세요.', icon: IMG.iconA2, reward: 50 },
    { id: 'A_3', title: '앱 출석 체크',desc: '오늘 앱에 접속해\n출석을 기록하세요.', icon: IMG.iconA3, reward: 50 },
    { id: 'A_4', title: '미션 달성률', desc: '오늘 전체 미션의\n70% 이상을 완료하세요.', icon: IMG.iconA4, reward: 50 },
  ],
  B: [
    { id: 'B_1', title: '포트폴리오 업로드', desc: '최근 작업물을 업로드하고\n활동을 인증하세요.',    emoji: '📁', reward: 100 },
    { id: 'B_2', title: '월 수입 변동성',    desc: '마이데이터 연동으로\n수입 내역을 확인하세요.', emoji: '💰', reward: 80  },
    { id: 'B_3', title: '수입 안정성 지수',  desc: '12개월 수입 데이터를\n분석하여 점수를 받으세요.', emoji: '📈', reward: 80  },
    { id: 'B_4', title: '업무 완료 인증',    desc: '프로젝트 완료 스크린샷을\n업로드하세요.',        emoji: '✅', reward: 100 },
  ],
  C: [
    { id: 'C_1', title: '소비 패턴 규칙성', desc: '마이데이터 기반으로\n소비 패턴을 분석하세요.',   emoji: '🛍️', reward: 60  },
    { id: 'C_2', title: '새벽 충동 결제',   desc: '새벽 00~06시 결제를\n0건으로 유지하세요.',       emoji: '🌙', reward: 60  },
    { id: 'C_3', title: '식료품 구매 인증', desc: '이번 달 마트/식료품\n구매를 인증하세요.',         emoji: '🛒', reward: 50  },
    { id: 'C_4', title: '잔고 유지 여부',   desc: '월 고정지출 대비\n충분한 잔고를 유지하세요.',    emoji: '🏦', reward: 70  },
  ],
  D: [
    { id: 'D_1', title: '운동 · 자기관리', desc: '오늘 6000보 이상 걷거나\n30분 운동하세요.',        emoji: '🏃', reward: 50  },
    { id: 'D_2', title: '대중교통 이용',   desc: '버스/지하철/따릉이 결제로\n친환경 이동을 인증하세요.', emoji: '🚇', reward: 50  },
    { id: 'D_3', title: '에너지 절약',     desc: '전기·가스 요금 고지서를\n업로드하세요.',           emoji: '⚡', reward: 60  },
    { id: 'D_4', title: '봉사 · 기부',     desc: '봉사 확인서 또는\n기부 영수증을 업로드하세요.',   emoji: '❤️', reward: 80  },
  ],
};

// ── 원형 달성률 차트 컴포넌트 ─────────────────────────────────
interface PieChartProps {
  filled:    number;   // 0~4 (완료된 미션 수)
  size:      number;
  fillColor: string;   // 채워진 영역 색상
  bgColor:   string;   // 배경 원 색상
  textColor: string;   // 중앙 텍스트 색상
}

function PieChart({ filled, size, fillColor, bgColor, textColor }: PieChartProps): React.JSX.Element {
  const r = size / 2;

  // 시계 방향 4등분: 우상(1) → 우하(2) → 좌하(3) → 좌상(4)
  const QUADRANTS: Array<{ top: number; left: number; width: number; height: number }> = [
    { top: 0, left: r, width: r, height: r }, // 1사분면 (우상)
    { top: r, left: r, width: r, height: r }, // 4사분면 (우하)
    { top: r, left: 0, width: r, height: r }, // 3사분면 (좌하)
    { top: 0, left: 0, width: r, height: r }, // 2사분면 (좌상)
  ];

  return (
    <View style={{ width: size, height: size }}>
      {/* 그림자 배경 원 */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: r,
        backgroundColor: '#dbd6ce',
        shadowColor: '#1c1c19', shadowOffset: { width: 2, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
      }} />
      {/* 배경색 + 세그먼트 클리핑 (overflow hidden으로 원형 클리핑) */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: r, overflow: 'hidden', backgroundColor: bgColor,
      }}>
        {QUADRANTS.slice(0, filled).map((q, i) => (
          <View key={i} style={{ position: 'absolute', backgroundColor: fillColor, ...q }} />
        ))}
      </View>
      {/* 내부 흰 원 — 도넛 효과로 텍스트 가독성 확보 */}
      <View style={{
        position: 'absolute',
        top: size * 0.2, left: size * 0.2,
        width: size * 0.6, height: size * 0.6,
        borderRadius: size * 0.3,
        backgroundColor: '#f5f2ed',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{
          fontFamily: 'Paperlogy-SemiBold',
          color: textColor,
          fontSize: size * 0.22,
          lineHeight: size * 0.28,
        }}>
          {filled}/4
        </Text>
      </View>
    </View>
  );
}

// ── 헬퍼: 자정까지 남은 시간 포맷 ───────────────────────────
function getCountdownUntilMidnight(): string {
  const now   = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff  = midnight.getTime() - now.getTime();
  const h     = Math.floor(diff / 3600000);
  const m     = Math.floor((diff % 3600000) / 60000);
  const s     = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatTodayKorean(): string {
  const now = new Date();
  return `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function MissionCenterScreen(): React.JSX.Element {
  const navigation = useNavigation<MissionNavProp>();
  const { dailyStatus, pointBalance, completeMission, loadDailyMissions } = useMissionStore();
  const { resolveUserId } = useAuthStore();

  const [selectedCat, setSelectedCat]     = useState<CatId>('A');
  const [modalMissionId, setModalMissionId] = useState<MissionFeatureId | null>(null);
  const [countdown, setCountdown]         = useState(getCountdownUntilMidnight());

  // 자정 타이머
  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdownUntilMidnight()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 화면 포커스 시마다 미션 상태 갱신
  // MissionUpload 화면에서 돌아왔을 때도 즉시 카드 상태 업데이트
  useFocusEffect(
    useCallback(() => {
      const userId = resolveUserId();
      void loadDailyMissions(userId);
    }, [loadDailyMissions, resolveUserId])
  );

  // 미션 완료 여부 확인
  const isMissionDone = useCallback((id: string): boolean => {
    return dailyStatus?.missions[id as MissionFeatureId] === true;
  }, [dailyStatus]);

  // 카테고리별 완료 수
  const getCatCompleted = useCallback((catId: CatId): number => {
    if (!dailyStatus?.missions) return 0;
    return ['1','2','3','4'].filter(n =>
      dailyStatus.missions[`${catId}_${n}` as MissionFeatureId] === true
    ).length;
  }, [dailyStatus]);

  // 미션 버튼 클릭
  const handleMission = useCallback((missionId: MissionFeatureId): void => {
    if (isMissionDone(missionId)) return;
    if (FILE_UPLOAD_MISSIONS.has(missionId)) {
      navigation.navigate('MissionUpload', { missionId });
      return;
    }
    setModalMissionId(missionId);
  }, [isMissionDone, navigation]);

  // 모달 완료 핸들러
  // [버그 수정] setModalMissionId(null) 제거
  //   이전: completeMission 완료 직후 모달을 강제 닫음
  //        → store의 dailyStatus 업데이트가 반영되기 전에 닫혀서 카드가 즉시 갱신되지 않음
  //   이후: 모달은 내부 isDone 화면의 '확인' 버튼으로만 닫힘
  //        → completeMission 완료 → store 업데이트 → 카드 즉시 갱신
  //        → 사용자가 '인증완료!' 화면을 보고 '확인'을 누르면 그때 모달 닫힘
  const handleModalSubmit = useCallback(async (rawDataJson: string, aiScore?: number): Promise<void> => {
    if (!modalMissionId) return;
    await completeMission(resolveUserId(), modalMissionId, rawDataJson, aiScore);
    // 모달은 MissionInputModal 내부의 onClose(확인 버튼)로 닫힘
  }, [completeMission, modalMissionId, resolveUserId]);

  // 코인 잔고는 missionStore의 pointBalance (DB 연동)에서 직접 읽음
  const coins    = pointBalance;
  const catMeta  = CATEGORIES[selectedCat];
  const missions = MISSIONS[selectedCat];
  const catIds: CatId[] = ['A', 'B', 'C', 'D'];

  // 현재 카테고리 진행률 (0~1)
  const catProgress = getCatCompleted(selectedCat) / 4;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f2ed' }}>

      {/* ─── 헤더 (Figma h:64px, px:24px) ──────────────────── */}
      <View style={{
        height: 64, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: 24,
        backgroundColor: 'rgba(252,249,244,0.7)',
        shadowColor: '#1c1c19', shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.06, shadowRadius: 48,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
          <Image source={IMG.border} style={{ width: 40, height: 40, borderRadius: 20 }} />
          <Text style={{ fontFamily: 'Hana2-Medium', color: '#006b58', fontSize: 18, letterSpacing: -0.45 }}>
            하나 더
          </Text>
        </View>
        <View style={{ width: 63, height: 27 }}>
          <View style={{
            position: 'absolute', top: 4, left: 0, right: 0, height: 19,
            backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 7,
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 27 }}>
            <Image source={IMG.coin} style={{ width: 24, height: 25 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: 13, marginLeft: 2 }}>
              {coins}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S(40) }}>

        {/* ─── 날짜 / 타이틀 섹션 ───────────────────────────── */}
        <View style={{ paddingHorizontal: S(24), paddingTop: S(16) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#383835', fontSize: S(14) }}>
                {formatTodayKorean()}
              </Text>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#006b58', fontSize: S(32), lineHeight: S(38) }}>
                미션 센터
              </Text>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), marginTop: S(2) }}>
                오늘의 미션을 달성하세요.
              </Text>
            </View>
            {/* 자정 카운트다운 */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#ba3200', fontSize: S(20), lineHeight: S(24) }}>
                {countdown}
              </Text>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#ba3200', fontSize: S(13) }}>
                {' '}후 종료
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 카테고리 요약 박스 (탭) ─────────────────────── */}
        <View style={{
          flexDirection: 'row', gap: S(10),
          paddingHorizontal: S(18), marginTop: S(16),
        }}>
          {catIds.map((catId) => {
            const meta    = CATEGORIES[catId];
            const done    = getCatCompleted(catId);
            const isActive = catId === selectedCat;
            return (
              <TouchableOpacity
                key={catId}
                onPress={() => setSelectedCat(catId)}
                style={{
                  flex: 1, height: S(70), borderRadius: S(14),
                  backgroundColor: isActive ? meta.bannerBg : 'rgba(133,133,133,0.3)',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOffset: { width: 1, height: 1 },
                  shadowOpacity: 0.1, shadowRadius: 2,
                }}>
                <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: S(15) }}>
                  {meta.label}
                </Text>
                <Text style={{ fontFamily: 'Hana2-Heavy', color: '#ba3200', fontSize: S(13), marginTop: S(4) }}>
                  {done}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── 카테고리 배너 ──────────────────────────────── */}
        <View style={{
          marginHorizontal: S(18), marginTop: S(12),
          backgroundColor: catMeta.bannerBg,
          borderRadius: S(15), paddingTop: S(10), paddingBottom: S(8),
          minHeight: S(145),
        }}>
          {/* 타이틀/서브타이틀 */}
          <View style={{ paddingHorizontal: S(15) }}>
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#090909', fontSize: S(24), lineHeight: S(28) }}>
              {catMeta.title}
            </Text>
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13) }}>
              {catMeta.subtitle}
            </Text>
          </View>
          {/* 진행바 */}
          <View style={{ paddingHorizontal: S(15), marginTop: S(12) }}>
            <View style={{
              height: S(9), borderRadius: S(10),
              backgroundColor: catMeta.progressBg,
            }}>
              {catProgress > 0 && (
                <View style={{
                  height: '100%', borderRadius: S(10),
                  backgroundColor: catMeta.progressFill,
                  width: (Math.round(catProgress * 100) + '%') as `${number}%`,
                }} />
              )}
            </View>
            <Text style={{
              fontFamily: 'Paperlogy-SemiBold', color: '#ba3200',
              fontSize: S(12), textAlign: 'right', marginTop: S(2),
            }}>
              {Math.round(catProgress * 100)}%
            </Text>
          </View>
          {/* 미션 태그 */}
          <View style={{ flexDirection: 'row', gap: S(5), paddingHorizontal: S(13), marginTop: S(4), flexWrap: 'nowrap' }}>
            {catMeta.tags.map((tag) => (
              <View key={tag} style={{
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: S(10), paddingHorizontal: S(8),
                height: S(27), alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#383835', fontSize: S(11) }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ─── 미션 카드 목록 ──────────────────────────────── */}
        <View style={{ marginHorizontal: S(18), marginTop: S(12), gap: S(12) }}>
          {missions.map((m) => {
            const done = isMissionDone(m.id);
            return (
              <View key={m.id} style={{
                backgroundColor: 'rgba(255,255,255,0.7)',
                borderRadius: S(15), height: S(87),
                shadowColor: '#000', shadowOffset: { width: 0.5, height: 0.5 },
                shadowOpacity: 0.1, shadowRadius: 2,
                flexDirection: 'row', alignItems: 'center',
              }}>
                {/* 미션 아이콘 */}
                <View style={{ width: S(65), alignItems: 'center' }}>
                  {m.icon ? (
                    <Image source={m.icon} style={{ width: S(40), height: S(40) }} resizeMode="contain" />
                  ) : (
                    <Text style={{ fontSize: S(32) }}>{m.emoji}</Text>
                  )}
                </View>

                {/* 미션 텍스트 */}
                <View style={{ flex: 1, paddingVertical: S(13) }}>
                  <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#090909', fontSize: S(16), lineHeight: S(20) }}>
                    {m.title}
                  </Text>
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(11), lineHeight: S(15), marginTop: S(3) }}>
                    {m.desc}
                  </Text>
                </View>

                {/* 미션 인증 버튼 + 파일첨부 태그 */}
                <View style={{ alignItems: 'center', marginRight: S(10), gap: S(4) }}>
                  {/* 파일업로드 미션에만 📎 파일첨부 태그 표시 */}
                  {FILE_UPLOAD_MISSIONS.has(m.id) && !done && (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: 'rgba(95,158,203,0.15)',
                      borderRadius: S(6), paddingHorizontal: S(5), paddingVertical: S(2),
                    }}>
                      <Text style={{ fontSize: S(9), color: '#5f9ecb' }}>📎 </Text>
                      <Text style={{ fontFamily: 'Paperlogy-Medium', fontSize: S(9), color: '#5f9ecb' }}>
                        파일첨부
                      </Text>
                    </View>
                  )}
                <TouchableOpacity
                  onPress={() => handleMission(m.id)}
                  disabled={done}
                  style={{
                    width: S(75), height: S(57),
                    backgroundColor: done ? 'rgba(150,196,180,0.5)' : 'rgba(254,231,75,0.31)',
                    borderRadius: S(10),
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#000', shadowOffset: { width: 1, height: 1 },
                    shadowOpacity: 0.1, shadowRadius: 4,
                  }}>
                  {done ? (
                    <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#006b58', fontSize: S(14) }}>
                      완료 ✓
                    </Text>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#747474', fontSize: S(13) }}>
                        미션 인증
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S(4) }}>
                        <Image source={IMG.coin} style={{ width: S(20), height: S(20) }} resizeMode="contain" />
                        <Text style={{ fontFamily: 'Paperlogy-Bold', color: '#c6a244', fontSize: S(13), marginLeft: S(2) }}>
                          +{m.reward}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
                </View>{/* 버튼+태그 wrapper 닫힘 */}
              </View>
            );
          })}
        </View>

        {/* ─── 달성률 한 눈에 보기 ─────────────────────────── */}
        <View style={{ marginTop: S(20), alignItems: 'center' }}>
          {/* 섹션 타이틀 버튼 */}
          <View style={{ position: 'relative', width: S(130), height: S(25), marginBottom: S(16) }}>
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,217,119,0.24)', borderRadius: S(3) }} />
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', fontSize: S(15), color: '#383835' }}>
                <Text style={{ color: '#ba3200' }}>달성률</Text>{' 한 눈에 보기'}
              </Text>
            </View>
          </View>

          {/* 원형 진행 4개 */}
          <View style={{ flexDirection: 'row', gap: S(13), justifyContent: 'center' }}>
            {catIds.map((catId) => {
              const meta = CATEGORIES[catId];
              const done = getCatCompleted(catId);
              return (
                <View key={catId} style={{ width: S(70), alignItems: 'center', gap: S(6) }}>
                  {/* 카테고리 레이블 */}
                  <View style={{ position: 'relative', width: S(54), height: S(19), alignItems: 'center' }}>
                    <View style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0,
                      width: S(39), backgroundColor: meta.bannerBg, borderRadius: S(5),
                    }} />
                    <Text style={{ position: 'absolute', fontFamily: 'Paperlogy-SemiBold', color: '#000', fontSize: S(11), lineHeight: S(19), textAlign: 'center', width: S(54) }}>
                      {meta.label}
                    </Text>
                  </View>
                  {/* 파이 차트 — 미션 완료 수만큼 1/4씩 채워짐 */}
                  <PieChart
                    filled={done}
                    size={S(76)}
                    fillColor={meta.progressFill}
                    bgColor={meta.pieBg}
                    textColor={meta.textColor}
                  />
                </View>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* ─── 미션 입력 모달 ─────────────────────────────────── */}
      <MissionInputModal
        visible={modalMissionId !== null}
        missionId={modalMissionId ?? 'A_1'}
        onSubmit={handleModalSubmit}
        onClose={() => setModalMissionId(null)}
      />
    </SafeAreaView>
  );
}
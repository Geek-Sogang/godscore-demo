// Figma 매칭: [메인보드 / 가상의 작업실 — HomeScreen]
/**
 * HomeScreen.tsx — Step 1 메인 홈 대시보드
 *
 * 웹 호환 포인트:
 *  - navigation prop은 옵셔널 (expo-router 환경에서 없어도 동작)
 *  - SafeAreaView edges 조건부 (web에서 SafeAreaView 문제 회피)
 *  - className (NativeWind) 전용 스타일링
 *
 * 구성:
 *  - 헤더: 닉네임 + 코인 잔고
 *  - 갓생점수 배지 (티어 + 점수 + 🔥 연속 달성)
 *  - 카테고리별 점수 미니 카드 4개
 *  - 가상 작업실 플레이스홀더
 *  - Today's Quest 카드 (일일 퀘스트 + 예상 획득 코인)
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectCurrentTier,
} from '../../application/stores/godScoreStore';
import { useMissionStore } from '../../application/stores/missionStore';
import { MISSION_DEFINITIONS } from '../../domain/entities/Mission';

// ── 상수 ────────────────────────────────────────────────────────────
const MOCK_USER = { id: 'user_001', nickname: '대흠님' };

const TIER_COLORS: Record<string, string> = {
  GOLD:     'text-amber-500',
  SILVER:   'text-slate-400',
  BRONZE:   'text-orange-700',
  IRON:     'text-gray-500',
  UNRANKED: 'text-gray-400',
};

const TIER_BG: Record<string, string> = {
  GOLD:     'bg-amber-50 border-amber-300',
  SILVER:   'bg-slate-50 border-slate-300',
  BRONZE:   'bg-orange-50 border-orange-300',
  IRON:     'bg-gray-50 border-gray-300',
  UNRANKED: 'bg-gray-50 border-gray-200',
};

// ── 서브 컴포넌트 ────────────────────────────────────────────────────

/** 헤더 갓생점수 배지 */
function GodScoreBadge({
  score,
  tier,
  streak,
}: {
  score: number;
  tier: string;
  streak: number;
}) {
  const tierLabel =
    tier === 'GOLD' ? '골드' :
    tier === 'SILVER' ? '실버' :
    tier === 'BRONZE' ? '브론즈' : '언랭크';

  return (
    <View className="items-center">
      <View
        className={`flex-row items-center gap-1 px-3 py-1 rounded-full border ${
          TIER_BG[tier] ?? 'bg-gray-50 border-gray-200'
        }`}
      >
        <Text className="text-xs font-semibold text-gray-500">{tierLabel}</Text>
      </View>
      <View className="flex-row items-end gap-1 mt-1">
        <Text
          className={`text-5xl font-black tracking-tight ${
            TIER_COLORS[tier] ?? 'text-gray-700'
          }`}
        >
          {score}
        </Text>
        <Text className="text-2xl mb-1">🔥</Text>
      </View>
      <Text className="text-xs text-gray-400 mt-0.5">{streak}일 연속 달성 중</Text>
    </View>
  );
}

/** 코인 잔고 칩 */
function CoinBadge({ balance }: { balance: number }) {
  return (
    <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 gap-1">
      <Text className="text-base">🪙</Text>
      <Text className="text-sm font-bold text-amber-700">
        {balance.toLocaleString()}
      </Text>
    </View>
  );
}

/** 가상 작업실 영역 */
function WorkspaceArea() {
  return (
    <View
      className="mx-4 rounded-3xl overflow-hidden h-52 border border-indigo-100"
      style={{ backgroundColor: '#EEF2FF' }}
    >
      {/* 바닥 레이어 */}
      <View
        className="absolute bottom-0 left-0 right-0 h-20"
        style={{ backgroundColor: '#FEF3C7', opacity: 0.6 }}
      />
      {/* 가구 오브젝트 */}
      <View className="absolute top-4 right-6 w-12 h-16 bg-amber-100 rounded-lg border border-amber-200 items-center justify-center">
        <Text className="text-2xl">🪴</Text>
      </View>
      <View className="absolute top-4 left-6 w-16 h-10 bg-blue-100 rounded-lg border border-blue-200 items-center justify-center">
        <Text className="text-xl">🖥️</Text>
      </View>
      <View className="absolute bottom-8 right-10 w-20 h-8 bg-amber-200 rounded-lg" />
      {/* 캐릭터 */}
      <View className="absolute bottom-4 left-0 right-0 items-center">
        <View className="w-24 h-28 bg-purple-100 rounded-t-full border-2 border-purple-200 items-center justify-center">
          <Text className="text-5xl">🧑‍💻</Text>
        </View>
        <View className="w-28 h-3 bg-purple-200 rounded-full opacity-40 mt-1" />
      </View>
      {/* 작업실 레벨 뱃지 */}
      <View className="absolute top-3 left-0 right-0 items-center">
        <View
          className="rounded-full px-3 py-1 border border-purple-100"
          style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
        >
          <Text className="text-xs font-semibold text-purple-600">🏠 내 작업실 Lv.3</Text>
        </View>
      </View>
    </View>
  );
}

/** 개별 퀘스트 아이템 */
function QuestItem({
  emoji,
  label,
  done,
  coins,
}: {
  emoji: string;
  label: string;
  done: boolean;
  coins: number;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 py-2.5 px-3 rounded-xl mb-1.5 border ${
        done ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'
      }`}
    >
      <View
        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
          done ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}
      >
        {done && <Text className="text-white text-xs font-bold">✓</Text>}
      </View>
      <Text className="text-base">{emoji}</Text>
      <Text
        className={`flex-1 text-sm font-medium ${
          done ? 'text-gray-400 line-through' : 'text-gray-700'
        }`}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-0.5">
        <Text className="text-xs">🪙</Text>
        <Text className="text-xs font-bold text-amber-600">+{coins}</Text>
      </View>
    </View>
  );
}

/** Today's Quest 카드 */
function TodaysQuestCard({
  completedCount,
  totalCount,
  onNavigate,
}: {
  completedCount: number;
  totalCount: number;
  onNavigate: () => void;
}) {
  const progress    = totalCount > 0 ? completedCount / totalCount : 0;
  const earnedCoins = completedCount * 50;
  const totalCoins  = totalCount * 50;

  const SAMPLE_QUESTS = [
    { emoji: '⏰', label: '오전 7시 기상 인증',  done: completedCount > 0,  coins: 50 },
    { emoji: '💼', label: '오늘 업무 완료 인증', done: completedCount > 1,  coins: 50 },
    { emoji: '🛒', label: '식료품 구매 인증',    done: completedCount > 2,  coins: 50 },
    { emoji: '♻️', label: '에너지 절약 미션',    done: completedCount > 3,  coins: 50 },
  ];

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 overflow-hidden"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 }}>
      {/* 카드 헤더 */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg">⚡</Text>
          <Text className="text-base font-bold text-gray-800">Today's Quest</Text>
        </View>
        <View className="flex-row items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full">
          <Text className="text-xs">🪙</Text>
          <Text className="text-xs font-bold text-amber-600">
            {earnedCoins} / {totalCoins}
          </Text>
        </View>
      </View>

      {/* 프로그레스 바 */}
      <View className="mx-4 mb-3">
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-green-400 rounded-full"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
        <Text className="text-xs text-gray-400 mt-1 text-right">
          {completedCount}/{totalCount} 완료
        </Text>
      </View>

      {/* 퀘스트 리스트 */}
      <View className="px-4 pb-2">
        {SAMPLE_QUESTS.map((q, i) => (
          <QuestItem key={i} {...q} />
        ))}
      </View>

      {/* 미션 센터 이동 버튼 */}
      <TouchableOpacity
        onPress={onNavigate}
        className="mx-4 mb-4 bg-green-500 rounded-2xl py-3 items-center"
        activeOpacity={0.85}
      >
        <Text className="text-white font-bold text-sm">미션 센터에서 인증하기 →</Text>
      </TouchableOpacity>
    </View>
  );
}

/** 카테고리별 점수 미니 카드 행 */
function ScoreAnalysisRow({ snapshot }: { snapshot: Record<string, number> | null | undefined }) {
  if (!snapshot) return null;
  const categories = [
    { label: '생활',   key: 'fA', emoji: '🌅', color: 'bg-orange-100 text-orange-600' },
    { label: '일·소득', key: 'fB', emoji: '💼', color: 'bg-blue-100 text-blue-600'   },
    { label: '소비',   key: 'fC', emoji: '💳', color: 'bg-purple-100 text-purple-600' },
    { label: 'ESG',    key: 'fD', emoji: '🌿', color: 'bg-green-100 text-green-600'  },
  ];
  return (
    <View className="mx-4 mt-3 flex-row gap-2">
      {categories.map(({ label, key, emoji, color }) => {
        const val = Math.round((snapshot[key] as number | undefined) ?? 0);
        return (
          <View key={key} className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 items-center">
            <Text className="text-xl mb-1">{emoji}</Text>
            <Text className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${color}`}>{label}</Text>
            <Text className="text-base font-black text-gray-800 mt-1">{val}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
interface HomeScreenProps {
  /** react-navigation에서 주입되는 navigation prop (옵셔널 — expo-router 환경 대응) */
  navigation?: { navigate: (screen: string) => void };
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const score    = useGodScoreStore(selectCurrentScore);
  const tier     = useGodScoreStore(selectCurrentTier);
  const snapshot = useGodScoreStore(s => s.currentSnapshot);
  const isCalc   = useGodScoreStore(s => s.isCalculating);
  const seedMock = useGodScoreStore(s => s.seedMockData);

  const pointBalance   = useMissionStore(s => s.pointBalance);
  const streak         = useMissionStore(s => s.streak);
  const dailyStatus    = useMissionStore(s => s.dailyStatus);
  const loadDailyMissions = useMissionStore(s => s.loadDailyMissions);

  useEffect(() => {
    seedMock(MOCK_USER.id);
    loadDailyMissions(MOCK_USER.id);
  }, []);

  const completedCount = dailyStatus
    ? Object.values(dailyStatus.missions).filter(Boolean).length
    : 0;
  const totalCount = Object.keys(MISSION_DEFINITIONS).length;
  const streakDays = streak?.currentStreak ?? 0;

  return (
    <SafeAreaView
      className="flex-1 bg-hana-cream"
      edges={Platform.OS === 'web' ? [] : ['top']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── 헤더 ── */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
          <View>
            <Text className="text-xs text-gray-400 font-medium">안녕하세요 👋</Text>
            <Text className="text-xl font-black text-gray-800">{MOCK_USER.nickname}</Text>
          </View>
          <CoinBadge balance={pointBalance} />
        </View>

        {/* ── 갓생점수 ── */}
        <View className="items-center py-5">
          {isCalc ? (
            <ActivityIndicator size="large" color="#00A651" />
          ) : (
            <GodScoreBadge
              score={Math.round(score)}
              tier={tier?.tier ?? 'UNRANKED'}
              streak={streakDays}
            />
          )}
        </View>

        {/* ── 카테고리별 점수 ── */}
        <ScoreAnalysisRow snapshot={snapshot as Record<string, number> | null | undefined} />

        {/* ── 가상 작업실 ── */}
        <View className="mt-5">
          <View className="flex-row items-center justify-between px-5 mb-2">
            <Text className="text-base font-bold text-gray-700">🏠 내 작업실</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text className="text-xs text-green-600 font-semibold">꾸미기 →</Text>
            </TouchableOpacity>
          </View>
          <WorkspaceArea />
        </View>

        {/* ── Today's Quest ── */}
        <View className="mt-1">
          <Text className="px-5 text-base font-bold text-gray-700 mb-1 mt-4">⚡ 오늘의 퀘스트</Text>
          <TodaysQuestCard
            completedCount={completedCount}
            totalCount={totalCount}
            onNavigate={() => navigation?.navigate?.('MissionCenter')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

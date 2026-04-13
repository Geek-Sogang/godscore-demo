// Figma 매칭: [미션 센터 — MissionCenterScreen]
/**
 * MissionCenterScreen.tsx
 * Step 2: 4대 피처 미션 센터
 *
 * 구성:
 *  - 상단: 탭 형태 4대 카테고리 (생활 루틴 / 일·소득 / 소비 행동 / 개인 ESG)
 *  - 탭별: 카테고리 헤더(이모지 + 컬러 + 진행률) + 세부 미션 카드 리스트
 *  - 미션 카드: 아이콘 + 설명 + 상태 + 완료 버튼 + txHash 표시
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMissionStore } from '../../application/stores/missionStore';
import { MISSION_DEFINITIONS } from '../../domain/entities/Mission';

// ── 미션 ID → 이모지 매핑 ─────────────────────────────────────────
const MISSION_EMOJI: Record<string, string> = {
  A_1: '⏰', A_2: '😴', A_3: '📅', A_4: '✅',
  B_1: '💼', B_2: '💵', B_3: '📈', B_4: '⭐',
  C_1: '💳', C_2: '🌙', C_3: '🛒', C_4: '🏦',
  D_1: '🏃', D_2: '🚌', D_3: '⚡', D_4: '🤝',
};

import type { MissionFeatureId } from '../../../types/features';

// ── 상수 ──────────────────────────────────────────────────────────
const MOCK_USER_ID = 'user_001';

interface CategoryMeta {
  id: 'A' | 'B' | 'C' | 'D';
  label: string;
  emoji: string;
  description: string;
  tabBg: string;
  headerBg: string;
  headerText: string;
  progressColor: string;
  chipBg: string;
  chipText: string;
  btnBg: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: 'A',
    label: '생활 루틴',
    emoji: '🌅',
    description: '자기통제력 · 지속성',
    tabBg: 'bg-amber-500',
    headerBg: 'bg-gradient-to-r from-amber-400 to-orange-400',
    headerText: 'text-white',
    progressColor: 'bg-amber-400',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    btnBg: 'bg-amber-500',
  },
  {
    id: 'B',
    label: '일·소득',
    emoji: '💼',
    description: '소득지속가능성 · 미래지향성',
    tabBg: 'bg-blue-500',
    headerBg: 'bg-gradient-to-r from-blue-500 to-cyan-400',
    headerText: 'text-white',
    progressColor: 'bg-blue-400',
    chipBg: 'bg-blue-50',
    chipText: 'text-blue-700',
    btnBg: 'bg-blue-500',
  },
  {
    id: 'C',
    label: '소비 행동',
    emoji: '💳',
    description: '충동성 · 소비통제력',
    tabBg: 'bg-slate-500',
    headerBg: 'bg-gradient-to-r from-slate-500 to-gray-500',
    headerText: 'text-white',
    progressColor: 'bg-slate-400',
    chipBg: 'bg-slate-50',
    chipText: 'text-slate-700',
    btnBg: 'bg-slate-600',
  },
  {
    id: 'D',
    label: '개인 ESG',
    emoji: '🌿',
    description: 'ESG 금융 통합 스코어',
    tabBg: 'bg-green-500',
    headerBg: 'bg-gradient-to-r from-green-500 to-emerald-400',
    headerText: 'text-white',
    progressColor: 'bg-green-400',
    chipBg: 'bg-green-50',
    chipText: 'text-green-700',
    btnBg: 'bg-green-500',
  },
];

// ── 탭 버튼 ────────────────────────────────────────────────────────
function CategoryTab({
  meta,
  isActive,
  onPress,
}: {
  meta: CategoryMeta;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-1 py-2.5 items-center rounded-xl mx-0.5 ${
        isActive ? meta.tabBg : 'bg-gray-100'
      }`}
    >
      <Text className="text-lg">{meta.emoji}</Text>
      <Text className={`text-xs font-semibold mt-0.5 ${isActive ? 'text-white' : 'text-gray-500'}`}>
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
}

// ── 카테고리 헤더 카드 ─────────────────────────────────────────────
function CategoryHeader({
  meta,
  completedCount,
  totalCount,
}: {
  meta: CategoryMeta;
  completedCount: number;
  totalCount: number;
}) {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const progressPct = Math.round(progress * 100);

  return (
    <View className="mx-4 mt-4 rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm">
      {/* 색상 헤더 */}
      <View className={`px-5 py-4 ${meta.tabBg}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center">
              <Text className="text-2xl">{meta.emoji}</Text>
            </View>
            <View>
              <Text className="text-white text-lg font-black">{meta.label}</Text>
              <Text className="text-white/70 text-xs mt-0.5">{meta.description}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-white text-3xl font-black">{completedCount}</Text>
            <Text className="text-white/70 text-xs">/ {totalCount} 완료</Text>
          </View>
        </View>
      </View>
      {/* 프로그레스 바 */}
      <View className="px-5 py-3">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-xs text-gray-500">진행률</Text>
          <Text className="text-xs font-bold text-gray-700">{progressPct}%</Text>
        </View>
        <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <View
            className={`h-full ${meta.progressColor} rounded-full`}
            style={{ width: `${progressPct}%` }}
          />
        </View>
        <Text className="text-xs text-gray-400 mt-1.5">
          {completedCount === totalCount
            ? '🎉 이 카테고리 모든 미션 완료!' 
            : `${totalCount - completedCount}개 미션이 남아있어요`}
        </Text>
      </View>
    </View>
  );
}

// ── 미션 카드 ──────────────────────────────────────────────────────
function MissionCard({
  missionId,
  definition,
  isCompleted,
  isProcessing,
  txHash,
  meta,
  onComplete,
}: {
  missionId: MissionFeatureId;
  definition: typeof MISSION_DEFINITIONS[keyof typeof MISSION_DEFINITIONS];
  isCompleted: boolean;
  isProcessing: boolean;
  txHash?: string;
  meta: CategoryMeta;
  onComplete: (id: MissionFeatureId) => void;
}) {
  return (
    <View className={`mx-4 mb-3 rounded-2xl border overflow-hidden ${
      isCompleted ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'
    }`}>
      <View className="p-4">
        {/* 미션 헤더 */}
        <View className="flex-row items-start gap-3">
          <View className={`w-11 h-11 rounded-xl items-center justify-center ${
            isCompleted ? 'bg-green-100' : meta.chipBg
          }`}>
            <Text className="text-xl">{MISSION_EMOJI[missionId] ?? '⚡'}</Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className={`text-sm font-bold ${isCompleted ? 'text-green-700' : 'text-gray-800'}`}>
                {definition.name}
              </Text>
              {isCompleted && (
                <View className="bg-green-500 rounded-full px-2 py-0.5">
                  <Text className="text-white text-xs font-bold">완료 ✓</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {definition.description}
            </Text>
          </View>
          {/* 코인 리워드 */}
          <View className="items-center">
            <Text className="text-base">🪙</Text>
            <Text className="text-xs font-bold text-amber-600">+{definition.rewardPoints}</Text>
          </View>
        </View>

        {/* 블록체인 해시 (완료된 경우) */}
        {isCompleted && txHash && (
          <View className="mt-3 bg-gray-800 rounded-xl p-2.5">
            <View className="flex-row items-center gap-1.5 mb-1">
              <Text className="text-xs">⛓️</Text>
              <Text className="text-xs font-semibold text-green-400">블록체인 기록 완료</Text>
            </View>
            <Text className="text-gray-400 text-xs font-mono" numberOfLines={1}>
              {txHash.slice(0, 20)}...{txHash.slice(-8)}
            </Text>
          </View>
        )}

        {/* 액션 버튼 */}
        {!isCompleted && (
          <TouchableOpacity
            onPress={() => onComplete(missionId)}
            disabled={isProcessing}
            className={`mt-3 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${
              isProcessing ? 'bg-gray-200' : meta.btnBg
            }`}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator size="small" color="#666" />
                <Text className="text-gray-500 text-sm font-semibold">인증 중...</Text>
              </>
            ) : (
              <Text className="text-white text-sm font-bold">미션 완료 인증 →</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function MissionCenterScreen() {
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});

  const dailyStatus     = useMissionStore(s => s.dailyStatus);
  const processingIds   = useMissionStore(s => s.processingMissionIds);
  const completeMission = useMissionStore(s => s.completeMission);
  const loadAndRefresh  = useMissionStore(s => s.loadAndRefreshAll);

  useEffect(() => {
    loadAndRefresh(MOCK_USER_ID);
  }, []);

  // 탭 카테고리의 미션 목록 필터링
  const currentMeta = CATEGORIES.find(c => c.id === activeTab)!;
  const categoryMissions = Object.entries(MISSION_DEFINITIONS).filter(
    ([id]) => id.startsWith(activeTab + '_')
  ) as [MissionFeatureId, typeof MISSION_DEFINITIONS[MissionFeatureId]][];

  const completedInCategory = categoryMissions.filter(
    ([id]) => dailyStatus?.missions[id as import('../../../types/features').MissionFeatureId] === true
  ).length;

  const handleComplete = useCallback(
    async (missionId: MissionFeatureId) => {
      try {
        const result = await completeMission(
          MOCK_USER_ID,
          missionId,
          JSON.stringify({ missionId, ts: Date.now() }),
          Math.random() * 40 + 60,
        );
        setTxHashes(prev => ({ ...prev, [missionId]: result.txHash }));
        Alert.alert('🎉 미션 완료!', `블록체인에 기록되었습니다.\n+50 코인 획득!`);
      } catch (err) {
        Alert.alert('오류', '미션 처리 중 문제가 발생했습니다.');
      }
    },
    [completeMission]
  );

  return (
    <SafeAreaView className="flex-1 bg-hana-lightgray" edges={['top']}>
      {/* ── 헤더 ── */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-black text-gray-800">⚡ 미션 센터</Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          오늘의 미션을 완료하고 갓생점수를 올려보세요
        </Text>
      </View>

      {/* ── 카테고리 탭 ── */}
      <View className="flex-row px-4 py-3 bg-white border-b border-gray-100 gap-1">
        {CATEGORIES.map(meta => (
          <CategoryTab
            key={meta.id}
            meta={meta}
            isActive={activeTab === meta.id}
            onPress={() => setActiveTab(meta.id)}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── 카테고리 헤더 ── */}
        <CategoryHeader
          meta={currentMeta}
          completedCount={completedInCategory}
          totalCount={categoryMissions.length}
        />

        {/* ── 미션 카드 리스트 ── */}
        <View className="mt-3">
          {categoryMissions.map(([missionId, def]) => {
            const isCompleted  = dailyStatus?.missions[missionId] === true;
            const isProcessing = processingIds.has(missionId);
            return (
              <MissionCard
                key={missionId}
                missionId={missionId}
                definition={def}
                isCompleted={isCompleted}
                isProcessing={isProcessing}
                txHash={txHashes[missionId]}
                meta={currentMeta}
                onComplete={handleComplete}
              />
            );
          })}
        </View>

        {/* ── 전체 진행률 요약 ── */}
        <View className="mx-4 mt-2 mb-2 bg-white rounded-2xl border border-gray-100 p-4">
          <Text className="text-sm font-bold text-gray-700 mb-3">📊 전체 카테고리 진행률</Text>
          {CATEGORIES.map(cat => {
            const missions = Object.keys(MISSION_DEFINITIONS).filter(id => id.startsWith(cat.id + '_'));
            const done = missions.filter(id => dailyStatus?.missions[id as import('../../../types/features').MissionFeatureId] === true).length;
            const pct = missions.length > 0 ? Math.round((done / missions.length) * 100) : 0;
            return (
              <View key={cat.id} className="mb-2.5">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm">{cat.emoji}</Text>
                    <Text className="text-xs font-semibold text-gray-600">{cat.label}</Text>
                  </View>
                  <Text className="text-xs font-bold text-gray-500">{done}/{missions.length}</Text>
                </View>
                <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <View className={`h-full ${cat.progressColor} rounded-full`} style={{ width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

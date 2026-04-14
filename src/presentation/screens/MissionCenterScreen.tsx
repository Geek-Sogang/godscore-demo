// Figma 매칭: [미션 센터 — MissionCenterScreen]
/**
 * MissionCenterScreen.tsx — Step 2 미션 센터
 *
 * [수정] 미션 유형별 제출 분기 로직 추가
 *   FILE_UPLOAD 미션 (B_1, B_4, D_3, D_4) → MissionUploadScreen으로 네비게이션
 *   그 외 미션 (INSTANT, DURATION, MYDATA) → MissionInputModal 표시
 *   MissionInputModal onSubmit → completeMission 호출 → txHash 저장
 *
 * 구성:
 *  - 상단 4탭 카테고리 (생활 루틴 / 일·소득 / 소비 행동 / 개인 ESG)
 *  - 탭별: 카테고리 헤더(진행률) + 미션 카드 리스트
 *  - 미션 카드: 이모지 + 이름 + 설명 + 리워드 + 완료 버튼 + txHash
 *  - 하단: 전체 카테고리 진행률 요약
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMissionStore } from '../../application/stores/missionStore';
import { MISSION_DEFINITIONS } from '../../domain/entities/Mission';
import type { MissionFeatureId } from '../../../types/features';
import MissionInputModal from './MissionInputModal';
import type { MissionStackParamList } from '../navigation/AppNavigator';

// ── 네비게이션 타입 ──────────────────────────────────────────────────
type MissionNavProp = NativeStackNavigationProp<MissionStackParamList, 'MissionCenterMain'>;

// ── 파일 업로드 미션 ID 목록 ─────────────────────────────────────────
// 이 미션들은 파일/사진 첨부가 필요해서 MissionUploadScreen으로 이동
const FILE_UPLOAD_MISSIONS: ReadonlySet<string> = new Set([
  'B_1', // 포트폴리오 업데이트 (PDF/MP4/PNG/ZIP)
  'B_4', // 업무 완료 인증 (스크린샷/링크)
  'D_3', // 에너지 절약 미션 (고지서 사진 OCR)
  'D_4', // 봉사·기부 활동 (확인서/영수증)
]);

// ── 미션 ID → 이모지 ─────────────────────────────────────────────
const MISSION_EMOJI: Record<string, string> = {
  A_1: '⏰', A_2: '😴', A_3: '📅', A_4: '✅',
  B_1: '💼', B_2: '💵', B_3: '📈', B_4: '⭐',
  C_1: '💳', C_2: '🌙', C_3: '🛒', C_4: '🏦',
  D_1: '🏃', D_2: '🚌', D_3: '⚡', D_4: '🤝',
};

// ── 상수 ────────────────────────────────────────────────────────────
const MOCK_USER_ID = 'user_001';

interface CategoryMeta {
  id: 'A' | 'B' | 'C' | 'D';
  label: string;
  emoji: string;
  description: string;
  tabBg: string;
  progressColor: string;
  chipBg: string;
  chipText: string;
  btnBg: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: 'A', label: '생활 루틴', emoji: '🌅', description: '자기통제력 · 지속성',
    tabBg: 'bg-amber-500', progressColor: 'bg-amber-400',
    chipBg: 'bg-amber-50', chipText: 'text-amber-700', btnBg: 'bg-amber-500',
  },
  {
    id: 'B', label: '일·소득', emoji: '💼', description: '소득지속가능성 · 미래지향성',
    tabBg: 'bg-blue-500', progressColor: 'bg-blue-400',
    chipBg: 'bg-blue-50', chipText: 'text-blue-700', btnBg: 'bg-blue-500',
  },
  {
    id: 'C', label: '소비 행동', emoji: '💳', description: '충동성 · 소비통제력',
    tabBg: 'bg-slate-500', progressColor: 'bg-slate-400',
    chipBg: 'bg-slate-50', chipText: 'text-slate-700', btnBg: 'bg-slate-600',
  },
  {
    id: 'D', label: '개인 ESG', emoji: '🌿', description: 'ESG 금융 통합 스코어',
    tabBg: 'bg-green-500', progressColor: 'bg-green-400',
    chipBg: 'bg-green-50', chipText: 'text-green-700', btnBg: 'bg-green-500',
  },
];

// ── 탭 버튼 ─────────────────────────────────────────────────────────
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

// ── 카테고리 헤더 카드 ───────────────────────────────────────────────
function CategoryHeader({
  meta,
  completedCount,
  totalCount,
}: {
  meta: CategoryMeta;
  completedCount: number;
  totalCount: number;
}) {
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <View className="mx-4 mt-4 rounded-3xl overflow-hidden bg-white border border-gray-100"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 }}>
      {/* 색상 헤더 */}
      <View className={`px-5 py-4 ${meta.tabBg}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text className="text-2xl">{meta.emoji}</Text>
            </View>
            <View>
              <Text className="text-white text-lg font-black">{meta.label}</Text>
              <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {meta.description}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-white text-3xl font-black">{completedCount}</Text>
            <Text className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              / {totalCount} 완료
            </Text>
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

// ── 미션 카드 ────────────────────────────────────────────────────────
function MissionCard({
  missionId,
  definition,
  isCompleted,
  isProcessing,
  isFileUpload,
  txHash,
  meta,
  onComplete,
}: {
  missionId: MissionFeatureId;
  definition: typeof MISSION_DEFINITIONS[keyof typeof MISSION_DEFINITIONS];
  isCompleted: boolean;
  isProcessing: boolean;
  isFileUpload: boolean;
  txHash?: string;
  meta: CategoryMeta;
  onComplete: (id: MissionFeatureId) => void;
}) {
  return (
    <View
      className={`mx-4 mb-3 rounded-2xl border overflow-hidden ${
        isCompleted ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'
      }`}
    >
      <View className="p-4">
        {/* 미션 헤더 */}
        <View className="flex-row items-start gap-3">
          <View
            className={`w-11 h-11 rounded-xl items-center justify-center ${
              isCompleted ? 'bg-green-100' : meta.chipBg
            }`}
          >
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
              {/* 파일 업로드 미션 뱃지 */}
              {isFileUpload && !isCompleted && (
                <View className="bg-purple-100 rounded-full px-2 py-0.5">
                  <Text className="text-purple-600 text-xs font-semibold">📎 파일 첨부</Text>
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

        {/* 블록체인 해시 */}
        {isCompleted && txHash && (
          <View className="mt-3 rounded-xl p-2.5" style={{ backgroundColor: '#1F2937' }}>
            <View className="flex-row items-center gap-1.5 mb-1">
              <Text className="text-xs">⛓️</Text>
              <Text className="text-xs font-semibold" style={{ color: '#34D399' }}>
                블록체인 기록 완료
              </Text>
            </View>
            <Text className="text-xs font-mono" style={{ color: '#9CA3AF' }} numberOfLines={1}>
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
              <Text className="text-white text-sm font-bold">
                {isFileUpload ? '📎 파일 업로드하여 인증 →' : '미션 완료 인증 →'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── 웹 안전 Alert ────────────────────────────────────────────────────
function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export default function MissionCenterScreen() {
  const [activeTab, setActiveTab]         = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [txHashes, setTxHashes]           = useState<Record<string, string>>({});
  // 모달에 표시할 미션 ID (null이면 모달 닫힘)
  const [modalMissionId, setModalMissionId] = useState<MissionFeatureId | null>(null);

  // ── 스토어 선택 ──────────────────────────────────────────────────
  const dailyStatus         = useMissionStore(s => s.dailyStatus);
  const processingMissionId = useMissionStore(s => s.processingMissionId);
  const completeMission     = useMissionStore(s => s.completeMission);
  const loadDailyMissions   = useMissionStore(s => s.loadDailyMissions);

  // ── 네비게이션 (MissionStack 안에서 실행) ───────────────────────
  const navigation = useNavigation<MissionNavProp>();

  useEffect(() => {
    loadDailyMissions(MOCK_USER_ID);
  }, []);

  const currentMeta = CATEGORIES.find(c => c.id === activeTab)!;

  const categoryMissions = Object.entries(MISSION_DEFINITIONS).filter(
    ([id]) => id.startsWith(activeTab + '_')
  ) as [MissionFeatureId, typeof MISSION_DEFINITIONS[MissionFeatureId]][];

  const completedInCategory = categoryMissions.filter(
    ([id]) => dailyStatus?.missions[id] === true
  ).length;

  /**
   * 미션 인증 버튼 클릭 시 분기 처리
   *   1. FILE_UPLOAD → MissionUploadScreen으로 이동
   *   2. INSTANT/DURATION/MYDATA → MissionInputModal 표시
   */
  const handleComplete = useCallback(
    (missionId: MissionFeatureId) => {
      if (FILE_UPLOAD_MISSIONS.has(missionId)) {
        // 파일 업로드 미션 → 전용 업로드 화면으로 이동
        navigation.navigate('MissionUpload', { missionId });
      } else {
        // 나머지 미션 → 인라인 입력 모달 표시
        setModalMissionId(missionId);
      }
    },
    [navigation],
  );

  /**
   * 모달에서 데이터 제출 완료 시 호출
   * rawDataJson: 미션별 수집 데이터 JSON 문자열
   * aiScore: AI 검증 점수 (0~100)
   */
  const handleModalSubmit = useCallback(
    async (rawDataJson: string, aiScore: number) => {
      if (!modalMissionId) return;
      const missionId = modalMissionId;
      // 모달을 먼저 닫아서 중복 제출 방지
      setModalMissionId(null);
      try {
        const result = await completeMission(
          MOCK_USER_ID,
          missionId,
          rawDataJson,
          aiScore,
        );
        setTxHashes(prev => ({ ...prev, [missionId]: result.txHash }));
        showAlert('🎉 미션 완료!', `블록체인에 기록되었습니다.\n+${MISSION_DEFINITIONS[missionId]?.rewardPoints ?? 50} 코인 획득!`);
      } catch {
        showAlert('오류', '미션 처리 중 문제가 발생했습니다.');
      }
    },
    [modalMissionId, completeMission],
  );

  return (
    <SafeAreaView
      className="flex-1 bg-hana-lightgray"
      edges={Platform.OS === 'web' ? [] : ['top']}
    >
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
            const isProcessing = processingMissionId === missionId;
            const isFileUpload = FILE_UPLOAD_MISSIONS.has(missionId);
            return (
              <MissionCard
                key={missionId}
                missionId={missionId}
                definition={def}
                isCompleted={isCompleted}
                isProcessing={isProcessing}
                isFileUpload={isFileUpload}
                txHash={txHashes[missionId]}
                meta={currentMeta}
                onComplete={handleComplete}
              />
            );
          })}
        </View>

        {/* ── 전체 카테고리 진행률 요약 ── */}
        <View className="mx-4 mt-2 mb-2 bg-white rounded-2xl border border-gray-100 p-4">
          <Text className="text-sm font-bold text-gray-700 mb-3">📊 전체 카테고리 진행률</Text>
          {CATEGORIES.map(cat => {
            const missions = Object.keys(MISSION_DEFINITIONS).filter(id => id.startsWith(cat.id + '_'));
            const done = missions.filter(id => dailyStatus?.missions[id as MissionFeatureId] === true).length;
            const pct  = missions.length > 0 ? Math.round((done / missions.length) * 100) : 0;
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
                  <View
                    className={`h-full ${cat.progressColor} rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── 인라인 미션 입력 모달 (INSTANT / DURATION / MYDATA 유형) ── */}
      {/* modalMissionId가 null이 아닐 때만 렌더링 → missionId 타입 보장 */}
      {modalMissionId !== null && (
        <MissionInputModal
          visible={true}
          missionId={modalMissionId}
          onClose={() => setModalMissionId(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </SafeAreaView>
  );
}

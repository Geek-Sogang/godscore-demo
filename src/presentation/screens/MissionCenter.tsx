// Figma 매칭: [미션 센터]
/**
 * src/presentation/screens/MissionCenter.tsx
 * 미션 센터 — 데이터 바인딩 Skeleton
 *
 * ⚠️  스타일링 금지 단계: View / Text / Button / ScrollView 원시 컴포넌트만 사용
 *
 * 바인딩 검증 항목:
 *  ✅ A/B/C/D 카테고리별 미션 목록 렌더링
 *  ✅ 미션 완료 버튼 → runMissionPipeline 전체 파이프라인 트리거
 *  ✅ 완료 상태 실시간 반영 (PENDING → VERIFIED)
 *  ✅ keccak256 txHash 텍스트 출력 (블록체인 기록 확인)
 *  ✅ 파이프라인 처리 중 로딩 표시
 *  ✅ 오늘 달성률 / 획득 포인트 실시간 표시
 *  ✅ 에러 핸들링 (AI 생성물 감지 / 중복 요청)
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Button, ScrollView, ActivityIndicator,
} from 'react-native';
import { useMissionStore, selectDailyCompletionRate } from '../../application/stores/missionStore';
import { useGodScoreStore } from '../../application/stores/godScoreStore';
import { MISSION_DEFINITIONS, getMissionsByCategory } from '../../domain/entities/Mission';
import type { MissionFeatureId, FeatureCategoryId } from '../../../types/features';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MissionCenter'>;

const MOCK_USER_ID = 'user_mock_001';
const CATEGORIES: FeatureCategoryId[] = ['A', 'B', 'C', 'D'];
const CATEGORY_LABELS: Record<FeatureCategoryId, string> = {
  A: '🌅 생활 루틴',
  B: '💼 일·소득',
  C: '💳 소비 행동',
  D: '🌱 개인 ESG',
};

export default function MissionCenter({ navigation }: Props) {
  // Figma 매칭: [미션 센터]
  const store = useMissionStore();
  const godScoreStore = useGodScoreStore();
  const completionRate = useMissionStore(selectDailyCompletionRate);

  // 개별 미션 txHash 저장 (블록체인 기록 확인용)
  const [txHashMap, setTxHashMap] = useState<Record<string, string>>({});
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    store.loadDailyMissions(MOCK_USER_ID);
    store.refreshPointBalance(MOCK_USER_ID);
    store.refreshStreak(MOCK_USER_ID);
  }, []);

  const handleCompleteMission = async (missionId: MissionFeatureId) => {
    setLastError(null);
    try {
      // rawData: 실서비스에서는 OS/SDK에서 수집한 실제 데이터 직렬화
      const rawData = JSON.stringify({
        missionId,
        userId: MOCK_USER_ID,
        deviceTs: Date.now(),
        mockPayload: `mock_raw_data_for_${missionId}`,
      });

      const { txHash, verified } = await store.completeMission(
        MOCK_USER_ID,
        missionId,
        rawData,
      );

      setTxHashMap(prev => ({ ...prev, [missionId]: txHash }));

      // 미션 완료 후 갓생점수 자동 재계산
      godScoreStore.calculateScore(MOCK_USER_ID);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : '미션 처리 실패');
    }
  };

  return (
    <ScrollView>
      {/* ── 헤더 ── */}
      <View>
        <Text>미션 센터</Text>
        <Text>오늘 달성률: {(completionRate * 100).toFixed(0)}%</Text>
        <Text>획득 포인트: {store.dailyStatus?.totalPointsEarned ?? 0}P</Text>
        <Text>
          완료: {store.dailyStatus?.completedCount ?? 0} /
          전체: {store.dailyStatus?.totalCount ?? 0}
        </Text>
      </View>

      {/* ── 에러 표시 ── */}
      {(lastError ?? store.error) && (
        <View>
          <Text>⚠️ 오류: {lastError ?? store.error}</Text>
          <Button title="오류 초기화" onPress={() => {
            setLastError(null);
            store.clearError();
          }} />
        </View>
      )}

      {/* ── 카테고리별 미션 목록 ── */}
      {CATEGORIES.map(cat => (
        <View key={cat}>
          {/* Figma 매칭: [미션 카테고리 섹션 헤더] */}
          <Text>{CATEGORY_LABELS[cat]}</Text>

          {getMissionsByCategory(cat).map(mission => {
            const isCompleted = store.completedLogs.some(
              l => l.missionId === mission.id,
            );
            const isProcessing = store.processingMissionId === mission.id;
            const txHash = txHashMap[mission.id];

            return (
              <View key={mission.id}>
                {/* Figma 매칭: [미션 카드] */}
                <Text>
                  [{mission.id}] {mission.name}
                  {isCompleted ? ' ✅' : ''}
                </Text>
                <Text>{mission.description}</Text>
                <Text>
                  인증방식: {mission.verificationMethod} |
                  보상: {mission.rewardPoints}P |
                  일일: {mission.isDaily ? 'Y' : 'N'}
                </Text>

                {/* 완료 상태 / 처리 중 / 완료 버튼 */}
                {isProcessing ? (
                  <View>
                    <ActivityIndicator />
                    <Text>파이프라인 처리 중... (SHA-256 → 검증 → DB → Blockchain)</Text>
                  </View>
                ) : isCompleted ? (
                  <View>
                    <Text>✅ 완료됨 (VERIFIED)</Text>
                    {txHash && (
                      <Text numberOfLines={1}>
                        txHash: {txHash.slice(0, 20)}...
                      </Text>
                    )}
                  </View>
                ) : (
                  <Button
                    title={`미션 완료 인증: ${mission.id}`}
                    onPress={() => handleCompleteMission(mission.id as MissionFeatureId)}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}

      {/* ── 스트릭 현황 ── */}
      {/* Figma 매칭: [스트릭 배지] */}
      <View>
        <Text>[ 스트릭 현황 ]</Text>
        {store.streak ? (
          <>
            <Text>연속 출석: {store.streak.currentStreak}일</Text>
            <Text>다음 보너스: {store.streak.daysToNextBonus}일 후</Text>
          </>
        ) : (
          <Text>스트릭 없음</Text>
        )}
      </View>

      {/* ── 네비게이션 ── */}
      <View>
        <Button title="← 홈" onPress={() => navigation.navigate('HomeDashboard')} />
        <Button title="→ 신용점수 상세" onPress={() => navigation.navigate('CreditScoreDetail')} />
      </View>
    </ScrollView>
  );
}

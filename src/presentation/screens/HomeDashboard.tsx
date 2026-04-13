// Figma 매칭: [메인보드 / 홈 대시보드]
/**
 * src/presentation/screens/HomeDashboard.tsx
 * 홈 대시보드 — 데이터 바인딩 Skeleton
 *
 * ⚠️  스타일링 금지 단계: View / Text / Button / ScrollView 원시 컴포넌트만 사용
 *     NativeWind / StyleSheet 적용은 Figma 디자인 확정 후 진행
 *
 * 바인딩 검증 항목:
 *  ✅ Zustand에서 갓생점수 실시간 렌더링
 *  ✅ 등급(Tier) 표시
 *  ✅ fA·fB·fC·fD 카테고리별 점수 분해
 *  ✅ 포인트 잔액 / 스트릭 현황
 *  ✅ 분기 재학습 시뮬레이션 버튼
 *  ✅ 점수 재계산 버튼
 *  ✅ 7일 이력 리스트
 */
import React from 'react';
import { View, Text, Button, ScrollView, ActivityIndicator } from 'react-native';
import { useGodScore } from '../../application/hooks/useGodScore';
import { useMissionStore } from '../../application/stores/missionStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeDashboard'>;

// Mock userId — 실서비스: Auth 컨텍스트에서 주입
const MOCK_USER_ID = 'user_mock_001';

export default function HomeDashboard({ navigation }: Props) {
  // Figma 매칭: [메인보드 / 홈 대시보드]
  const {
    currentScore,
    tier,
    breakdown,
    scoreHistory,
    isCalculating,
    confidence,
    topPositiveFeatures,
    topNegativeFeatures,
    currentWeights,
    recalculate,
    runQuarterlyRetraining,
    error,
  } = useGodScore(MOCK_USER_ID);

  const pointBalance = useMissionStore(s => s.pointBalance);
  const streak = useMissionStore(s => s.streak);

  return (
    <ScrollView>
      {/* ── 헤더 영역 ── */}
      <View>
        <Text>하나 더 — 홈 대시보드</Text>
        <Text>userId: {MOCK_USER_ID}</Text>
      </View>

      {/* ── 갓생점수 메인 표시 ── */}
      {/* Figma 매칭: [갓생스코어 대형 숫자 UI] */}
      <View>
        <Text>[ 갓생점수 ]</Text>
        {isCalculating ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text>현재 점수: {currentScore.toFixed(1)}</Text>
            <Text>등급: {tier.label}</Text>
            <Text>예측 신뢰도: {(confidence * 100).toFixed(0)}%</Text>
          </>
        )}
      </View>

      {/* ── 카테고리별 분해 점수 (fA ~ fD) ── */}
      {/* Figma 매칭: [카테고리 점수 바 차트] */}
      <View>
        <Text>[ 피처별 점수 분해 ]</Text>
        {breakdown ? (
          <>
            <Text>fA 생활루틴:  {breakdown.fA.toFixed(1)} (가중치 wA={currentWeights.wA})</Text>
            <Text>fB 일·소득:   {breakdown.fB.toFixed(1)} (가중치 wB={currentWeights.wB})</Text>
            <Text>fC 소비행동:  {breakdown.fC.toFixed(1)} (가중치 wC={currentWeights.wC})</Text>
            <Text>fD 개인ESG:   {breakdown.fD.toFixed(1)} (가중치 wD={currentWeights.wD})</Text>
            <Text>최종 S:       {breakdown.totalScore.toFixed(1)}</Text>
          </>
        ) : (
          <Text>점수 데이터 없음</Text>
        )}
      </View>

      {/* ── 포인트 & 스트릭 ── */}
      {/* Figma 매칭: [포인트 / 스트릭 배지] */}
      <View>
        <Text>[ 포인트 & 스트릭 ]</Text>
        <Text>포인트 잔액: {pointBalance}P</Text>
        {streak ? (
          <>
            <Text>현재 스트릭: {streak.currentStreak}일 연속</Text>
            <Text>최장 스트릭: {streak.longestStreak}일</Text>
            <Text>다음 보너스까지: {streak.daysToNextBonus}일</Text>
          </>
        ) : (
          <Text>스트릭 데이터 없음</Text>
        )}
      </View>

      {/* ── SHAP 상위 기여 피처 ── */}
      {/* Figma 매칭: [신용 점수 영향 요인 카드] */}
      <View>
        <Text>[ 점수 상승 기여 TOP3 ]</Text>
        {topPositiveFeatures.length > 0 ? (
          topPositiveFeatures.map(f => (
            <Text key={f.featureId}>
              ▲ {f.featureName} ({f.featureId}): +{f.shapValue.toFixed(2)}
            </Text>
          ))
        ) : (
          <Text>데이터 계산 중...</Text>
        )}

        <Text>[ 점수 하락 요인 TOP3 ]</Text>
        {topNegativeFeatures.length > 0 ? (
          topNegativeFeatures.map(f => (
            <Text key={f.featureId}>
              ▼ {f.featureName} ({f.featureId}): {f.shapValue.toFixed(2)}
            </Text>
          ))
        ) : (
          <Text>데이터 계산 중...</Text>
        )}
      </View>

      {/* ── 7일 점수 이력 ── */}
      {/* Figma 매칭: [점수 추이 라인 차트] */}
      <View>
        <Text>[ 최근 7일 점수 이력 ]</Text>
        {scoreHistory.slice(-7).map(h => (
          <Text key={h.date}>{h.date}: {h.score.toFixed(1)}점</Text>
        ))}
      </View>

      {/* ── 에러 표시 ── */}
      {error && (
        <View>
          <Text>⚠️ 오류: {error}</Text>
        </View>
      )}

      {/* ── 액션 버튼 ── */}
      {/* Figma 매칭: [미션 센터 이동 / 점수 재계산 버튼] */}
      <View>
        <Button
          title="점수 재계산 (Mock 데이터)"
          onPress={() => recalculate()}
        />
        <Button
          title="분기 재학습 시뮬레이션 (XGBoost Mock)"
          onPress={runQuarterlyRetraining}
        />
        <Button
          title="→ 미션 센터"
          onPress={() => navigation.navigate('MissionCenter')}
        />
        <Button
          title="→ 신용점수 상세"
          onPress={() => navigation.navigate('CreditScoreDetail')}
        />
      </View>
    </ScrollView>
  );
}

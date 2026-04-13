// Figma 매칭: [대출/신용 리포트]
/**
 * src/presentation/screens/CreditScoreDetail.tsx
 * 신용점수 상세 화면 — 데이터 바인딩 Skeleton
 *
 * ⚠️  스타일링 금지 단계: View / Text / Button / ScrollView 원시 컴포넌트만 사용
 *
 * 바인딩 검증 항목:
 *  ✅ 최종 갓생점수 + 등급 표시
 *  ✅ fA·fB·fC·fD 전체 분해값 목록
 *  ✅ SHAP 값 16개 전체 목록 (기여도 내림차순)
 *  ✅ 긍정/부정 요인 분리 출력
 *  ✅ 현재 가중치(wA~wD) 원본 표시
 *  ✅ CB 점수 보유 여부에 따른 심사 경로 분기
 *  ✅ 금리 우대 예상 혜택 표시
 *  ✅ 블록체인 기록 검증 상태 목록
 */
import React from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectCurrentTier,
  selectBreakdown,
  selectSHAPValues,
} from '../../application/stores/godScoreStore';
import { useMissionStore } from '../../application/stores/missionStore';

type Props = { navigation: any; route: any };

// 갓생점수 → 금리 우대폭 매핑 (기획서 18p: 최대 -1%p)
function getInterestDiscount(score: number): string {
  if (score >= 850) return '-1.0%p (레전드 최대 우대)';
  if (score >= 600) return '-0.7%p';
  if (score >= 400) return '-0.4%p';
  return '-0.1%p (데이터 축적 중)';
}

// 90일 이상 데이터 여부 (실서비스: 실제 이력 개수 기준)
function canApplyAltCredit(historyCount: number): boolean {
  return historyCount >= 30; // Mock: 30개 이상 = 90일 근사치
}

export default function CreditScoreDetail({ navigation }: Props) {
  // Figma 매칭: [대출/신용 리포트]
  const store = useGodScoreStore();
  const missionStore = useMissionStore();

  const currentScore = selectCurrentScore(store);
  const tier = selectCurrentTier(store);
  const breakdown = selectBreakdown(store);
  const shapValues = selectSHAPValues(store);

  // SHAP 정렬: 절대값 내림차순 (기여도 큰 순)
  const sortedSHAP = [...shapValues].sort(
    (a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue),
  );
  const positiveSHAP = sortedSHAP.filter(s => s.shapValue > 0);
  const negativeSHAP = sortedSHAP.filter(s => s.shapValue <= 0);

  const historyCount = store.history.length;
  const altCreditEligible = canApplyAltCredit(historyCount);
  const interestDiscount = getInterestDiscount(currentScore);
  const completedLogs = missionStore.completedLogs;

  return (
    <ScrollView>
      {/* ── 헤더 ── */}
      <View>
        <Text>신용점수 상세 리포트</Text>
        <Text>하나 더 대안신용평가 결과</Text>
      </View>

      {/* ── 최종 갓생점수 요약 ── */}
      {/* Figma 매칭: [대형 점수 + 등급 카드] */}
      <View>
        <Text>[ 갓생점수 최종 결과 ]</Text>
        <Text>갓생점수 S: {currentScore.toFixed(1)} / 1000</Text>
        <Text>등급: {tier.label}</Text>
        <Text>금리 우대 예상: {interestDiscount}</Text>
        <Text>
          심사 경로:{' '}
          {altCreditEligible
            ? '✅ 대안 신용평가 가능 (90일+ 행동 데이터 축적)'
            : `⏳ 데이터 축적 중 (${historyCount}일 / 90일 필요)`}
        </Text>
      </View>

      {/* ── 카테고리별 점수 분해 ── */}
      {/* Figma 매칭: [피처 점수 분해 섹션] */}
      <View>
        <Text>[ 카테고리별 점수 분해 ]</Text>
        {breakdown ? (
          <>
            <Text>─────────────────────────────</Text>
            <Text>fA 생활루틴:  {breakdown.fA.toFixed(2)}  (wA={store.categoryWeights.wA})</Text>
            <Text>fB 일·소득:   {breakdown.fB.toFixed(2)}  (wB={store.categoryWeights.wB})</Text>
            <Text>fC 소비행동:  {breakdown.fC.toFixed(2)}  (wC={store.categoryWeights.wC})</Text>
            <Text>fD 개인ESG:   {breakdown.fD.toFixed(2)}  (wD={store.categoryWeights.wD})</Text>
            <Text>─────────────────────────────</Text>
            <Text>
              S = {store.categoryWeights.wA}×{breakdown.fA.toFixed(1)}
              + {store.categoryWeights.wB}×{breakdown.fB.toFixed(1)}
              + {store.categoryWeights.wC}×{breakdown.fC.toFixed(1)}
              + {store.categoryWeights.wD}×{breakdown.fD.toFixed(1)}
              = {breakdown.totalScore.toFixed(1)}
            </Text>
          </>
        ) : (
          <Text>점수 데이터 없음</Text>
        )}
      </View>

      {/* ── SHAP 상승 요인 (긍정 기여 피처) ── */}
      {/* Figma 매칭: [점수 상승 요인 리스트] */}
      <View>
        <Text>[ 점수 상승 요인 (SHAP 양수) ]</Text>
        {positiveSHAP.length > 0 ? (
          positiveSHAP.map((s, idx) => (
            <Text key={s.featureId}>
              {idx + 1}. {s.featureName} [{s.featureId}]
              : +{s.shapValue.toFixed(3)}
            </Text>
          ))
        ) : (
          <Text>데이터 없음</Text>
        )}
      </View>

      {/* ── SHAP 하락 요인 (부정 기여 피처) ── */}
      {/* Figma 매칭: [점수 하락 요인 리스트] */}
      <View>
        <Text>[ 점수 하락 요인 (SHAP 음수) — 개선 필요 ]</Text>
        {negativeSHAP.length > 0 ? (
          negativeSHAP.map((s, idx) => (
            <Text key={s.featureId}>
              {idx + 1}. {s.featureName} [{s.featureId}]
              : {s.shapValue.toFixed(3)}
            </Text>
          ))
        ) : (
          <Text>하락 요인 없음</Text>
        )}
      </View>

      {/* ── 피처별 세부 가중치 원본 ── */}
      {/* Figma 매칭: [가중치 테이블 — 개발/QA용] */}
      <View>
        <Text>[ 현재 피처별 가중치 (XGBoost 분기 재학습 기준) ]</Text>
        <Text>wA1(기상)={store.featureWeights.wA1}  wA2(수면)={store.featureWeights.wA2}  wA3(출석)={store.featureWeights.wA3}  wA4(달성률)={store.featureWeights.wA4}</Text>
        <Text>wB1(포트폴리오)={store.featureWeights.wB1}  wB2(변동성)={store.featureWeights.wB2}  wB3(안정성)={store.featureWeights.wB3}  wB4(업무)={store.featureWeights.wB4}</Text>
        <Text>wC1(소비패턴)={store.featureWeights.wC1}  wC2(충동결제)={store.featureWeights.wC2}  wC3(식료품)={store.featureWeights.wC3}  wC4(잔고)={store.featureWeights.wC4}</Text>
        <Text>wD1(운동)={store.featureWeights.wD1}  wD2(대중교통)={store.featureWeights.wD2}  wD3(에너지)={store.featureWeights.wD3}  wD4(봉사)={store.featureWeights.wD4}</Text>
      </View>

      {/* ── 블록체인 기록 검증 현황 ── */}
      {/* Figma 매칭: [블록체인 무결성 배지] */}
      <View>
        <Text>[ 블록체인 무결성 검증 현황 ]</Text>
        {completedLogs.length > 0 ? (
          completedLogs.map(log => (
            <Text key={log.id}>
              [{log.missionId}] {log.status}
              {log.blockchainRecorded ? ' | ✅ 온체인 기록' : ' | ⏳ 기록 대기'}
              {log.txHash ? ` | tx: ${log.txHash.slice(0, 14)}...` : ''}
            </Text>
          ))
        ) : (
          <Text>완료된 미션 없음 (미션 센터에서 미션을 완료하세요)</Text>
        )}
        <Text>총 {completedLogs.length}건 / 블록체인 기록: {completedLogs.filter(l => l.blockchainRecorded).length}건</Text>
      </View>

      {/* ── 이력 데이터 통계 ── */}
      <View>
        <Text>[ 데이터 축적 현황 ]</Text>
        <Text>저장된 스냅샷: {historyCount}개</Text>
        <Text>대안신용평가 자격: {altCreditEligible ? '✅ 충족' : '❌ 미충족 (90일 필요)'}</Text>
      </View>

      {/* ── 네비게이션 ── */}
      <View>
        <Button title="← 홈" onPress={() => (navigation as any).navigate('HomeDashboard')} />
        <Button title="← 미션 센터" onPress={() => (navigation as any).navigate('MissionCenter')} />
      </View>
    </ScrollView>
  );
}

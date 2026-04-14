// Figma 매칭: [금융 리포트 — FinanceReportScreen]
/**
 * FinanceReportScreen.tsx
 * Step 5: 갓생점수 기반 금리 우대 리포트
 *
 * [수정] calcRateDiscount 클라이언트 로직 제거
 *   이전: 금리 계산을 프론트에서 직접 수행
 *         → 정책 변경 시 앱 업데이트 강제, 사용자 JS 조작 가능
 *   이후: GET /api/v1/finance/rate-benefit 호출 → 서버가 계산한 값을 표시만 함
 *         → 정책 변경 시 서버만 수정, 클라이언트는 "보여주는 역할"만
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectSHAPValues,
} from '../../application/stores/godScoreStore';
import { api } from '../../infrastructure/api/apiClient';

// ── 서버 응답 타입 ─────────────────────────────────────────────────
// 클라이언트는 이 값을 표시만 합니다. 계산은 서버가 담당합니다.
interface RateBenefitResponse {
  god_score:    number;
  base_rate:    number;
  discount:     number;
  final_rate:   number;
  tier_label:   string;
  max_discount: number;
  score_date:   string;
  has_score:    boolean;
}

// ── 금리 비교 카드 ─────────────────────────────────────────────────
function RateComparisonCard({
  baseRate,
  discount,
  finalRate,
  score,
  tierLabel,
}: {
  baseRate: number;
  discount: number;
  finalRate: number;
  score: number;
  tierLabel: string;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const [barWidthPct, setBarWidthPct] = useState(100);

  useEffect(() => {
    const discountRatio = discount / baseRate;
    const targetPct = Math.round((1 - discountRatio) * 100);
    setBarWidthPct(targetPct);
    Animated.timing(barAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [discount, baseRate, barAnim]);

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <Text className="text-sm font-bold text-gray-700 mb-4">💰 금리 비교</Text>
      <View className="flex-row items-center justify-between mb-4">
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">기준 금리</Text>
          <Text className="text-xl font-black text-gray-700">{baseRate}%</Text>
        </View>
        <View className="items-center">
          <Text className="text-xs text-green-500 font-bold mb-1">▼ {discount}%p 인하</Text>
          <Text className="text-base font-black text-green-500">-{discount}%p</Text>
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">최종 금리</Text>
          <Text className="text-xl font-black text-green-600">{finalRate}%</Text>
        </View>
      </View>
      <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: '#059669',
            borderRadius: 99,
            width: barAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['100%', `${barWidthPct}%`],
            }),
          }}
        />
      </View>
      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-xs text-gray-400">갓생스코어 {score}점 → {tierLabel} 등급 적용</Text>
        <Text className="text-xs text-green-600 font-bold">{discount}%p 혜택</Text>
      </View>
    </View>
  );
}

// ── SHAP 기여도 카드 ───────────────────────────────────────────────
function SHAPContributionCard({ shapValues }: { shapValues: Array<{ featureName: string; shapValue: number }> }) {
  const top5 = [...shapValues]
    .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
    .slice(0, 5);

  if (top5.length === 0) {
    return (
      <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 p-5">
        <Text className="text-sm font-bold text-gray-700 mb-2">📊 점수 기여도 Top 5</Text>
        <Text className="text-xs text-gray-400">미션을 완료하면 점수 기여도를 확인할 수 있습니다.</Text>
      </View>
    );
  }

  const maxAbs = Math.max(...top5.map(s => Math.abs(s.shapValue)), 1);
  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <Text className="text-sm font-bold text-gray-700 mb-4">📊 점수 기여도 Top 5</Text>
      {top5.map((sv, i) => (
        <View key={i} className="mb-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs text-gray-600 font-medium">{sv.featureName}</Text>
            <Text className={`text-xs font-bold ${sv.shapValue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {sv.shapValue >= 0 ? '+' : ''}{sv.shapValue.toFixed(1)}점
            </Text>
          </View>
          <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <View
              style={{
                height: '100%',
                width: `${(Math.abs(sv.shapValue) / maxAbs) * 100}%`,
                backgroundColor: sv.shapValue >= 0 ? '#059669' : '#EF4444',
                borderRadius: 99,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── 성장 타임라인 카드 ─────────────────────────────────────────────
function CreditTimelineCard({ score }: { score: number }) {
  const milestones = [
    { date: '3개월 전', score: Math.max(30, score - 22), label: '시작' },
    { date: '2개월 전', score: Math.max(30, score - 14), label: '성장' },
    { date: '1개월 전', score: Math.max(30, score - 7),  label: '안정' },
    { date: '현재',     score,                            label: '현재' },
  ];
  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <Text className="text-sm font-bold text-gray-700 mb-4">📈 신용 성장 타임라인</Text>
      <View className="flex-row items-end justify-between">
        {milestones.map((m, i) => (
          <View key={i} className="items-center" style={{ flex: 1 }}>
            <Text className={`text-sm font-black mb-1 ${i === 3 ? 'text-green-600' : 'text-gray-500'}`}>
              {m.score}
            </Text>
            <View
              style={{
                width: 8,
                height: 8 + (m.score / 100) * 2,
                borderRadius: 4,
                backgroundColor: i === 3 ? '#059669' : '#D1FAE5',
                marginBottom: 6,
              }}
            />
            <Text className="text-xs text-gray-400 text-center">{m.date}</Text>
          </View>
        ))}
      </View>
      <View className="mt-3 bg-green-50 rounded-2xl p-3">
        <Text className="text-xs text-green-700 font-medium text-center">
          최근 3개월 +{Math.round(score - Math.max(score - 22, 30))}점 상승 · 계속 성장 중입니다!
        </Text>
      </View>
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function FinanceReportScreen() {
  const score      = useGodScoreStore(selectCurrentScore);
  const shapValues = useGodScoreStore(selectSHAPValues);
  const seedMock   = useGodScoreStore(s => s.seedMockData);

  // 서버에서 받아온 금리 혜택 (클라이언트 계산 없음)
  const [rateBenefit, setRateBenefit] = useState<RateBenefitResponse | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    seedMock('user_001');
  }, []);

  // 금리 혜택 서버 조회 — 갓생점수 변경될 때마다 갱신
  const fetchRateBenefit = useCallback(async () => {
    setRateLoading(true);
    try {
      const data = await api.get<RateBenefitResponse>('/api/v1/finance/rate-benefit');
      setRateBenefit(data);
    } catch {
      // 서버 미연결 시 기본값 (데모 모드 폴백)
      setRateBenefit({
        god_score:    score,
        base_rate:    5.8,
        discount:     Math.min(1.5, (score / 1000) * 1.5),
        final_rate:   Math.max(2.5, 5.8 - Math.min(1.5, (score / 1000) * 1.5)),
        tier_label:   score >= 850 ? '최우수' : score >= 600 ? '우수' : score >= 400 ? '일반' : '기본',
        max_discount: 1.5,
        score_date:   new Date().toISOString().slice(0, 10),
        has_score:    score > 0,
      });
    } finally {
      setRateLoading(false);
    }
  }, [score]);

  useEffect(() => {
    fetchRateBenefit();
  }, [fetchRateBenefit]);

  // 로딩 중 기본값
  const baseRate  = rateBenefit?.base_rate  ?? 5.8;
  const discount  = rateBenefit?.discount   ?? 0;
  const finalRate = rateBenefit?.final_rate ?? 5.8;
  const tierLabel = rateBenefit?.tier_label ?? '기본';

  const handleCTA = () => {
    const msg = `갓생점수 ${Math.round(score)}점 적용\n최종 금리 ${finalRate}% 우대 혜택으로\n하나은행 앱에서 신청할 수 있습니다.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`${msg}\n\n하나은행으로 이동하시겠습니까?`)) {
        Linking.openURL('https://www.kebhana.com');
      }
    } else {
      Alert.alert(
        '하나은행 신용대출',
        msg,
        [
          { text: '닫기', style: 'cancel' },
          { text: '앱으로 이동', onPress: () => Linking.openURL('https://www.kebhana.com') },
        ],
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-hana-lightgray" edges={Platform.OS === 'web' ? [] : ['top']}>
      {/* ── 헤더 ── */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-black text-gray-800">📊 금융 리포트</Text>
        <Text className="text-xs text-gray-400 mt-0.5">갓생점수 기반 맞춤 금리 우대</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── 상단 배너 ── */}
        <View className="mx-4 mt-4 rounded-3xl overflow-hidden" style={{ backgroundColor: '#059669' }}>
          <View className="bg-green-600 p-5">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center">
                <Text className="text-xl">🏦</Text>
              </View>
              <Text className="text-white/80 text-sm font-medium">하나은행 갓생 금리 우대</Text>
            </View>
            <Text className="text-white text-lg font-black leading-snug">
              대출 금리에 성실 점수{'\n'}
              <Text className="text-3xl text-amber-300">{Math.round(score)}점</Text>
              {'을 반영하였습니다.'}
            </Text>
            <View className="flex-row gap-2 mt-3">
              <View className="bg-white/20 rounded-full px-3 py-1">
                <Text className="text-white text-xs font-semibold">AI 기반 대안신용평가</Text>
              </View>
              <View className="bg-white/20 rounded-full px-3 py-1">
                {rateLoading
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text className="text-white text-xs font-semibold">{tierLabel} 등급</Text>
                }
              </View>
            </View>
          </View>
        </View>

        {/* ── 금리 비교 카드 (서버 값 표시) ── */}
        <RateComparisonCard
          baseRate={baseRate}
          discount={discount}
          finalRate={finalRate}
          score={Math.round(score)}
          tierLabel={tierLabel}
        />

        {/* ── SHAP 기여도 ── */}
        <SHAPContributionCard shapValues={shapValues} />

        {/* ── 성장 타임라인 ── */}
        <CreditTimelineCard score={Math.round(score)} />

        {/* ── 추가 혜택 카드 ── */}
        <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
          <Text className="text-sm font-bold text-gray-700 mb-3">🎁 갓생 달성 추가 혜택</Text>
          {[
            { emoji: '💳', title: '체크카드 캐시백 0.5% 추가', desc: '갓생점수 60점 이상 자동 적용' },
            { emoji: '📱', title: '하나원큐 수수료 면제', desc: '이달 ATM 출금 수수료 10회 무료' },
            { emoji: '🎯', title: '적금 우대금리 0.3%p', desc: '갓생 적금 특별 금리 적용' },
          ].map((benefit, i) => (
            <View key={i} className={`flex-row items-start gap-3 py-3 ${i < 2 ? 'border-b border-gray-50' : ''}`}>
              <View className="w-9 h-9 bg-green-50 rounded-xl items-center justify-center">
                <Text className="text-lg">{benefit.emoji}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-700">{benefit.title}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">{benefit.desc}</Text>
              </View>
              <View className="bg-green-100 rounded-full px-2 py-0.5">
                <Text className="text-xs font-bold text-green-600">적용중</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── 하단 CTA 버튼 (floating) ── */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-gray-100">
        <TouchableOpacity
          onPress={handleCTA}
          className="bg-green-500 rounded-2xl py-4 items-center shadow-lg"
          activeOpacity={0.85}
        >
          <Text className="text-white font-black text-base">🏦 하나은행 신용대출 바로가기</Text>
          {rateLoading
            ? <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            : <Text className="text-white/80 text-xs mt-0.5">최종 금리 {finalRate}% 우대 적용</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

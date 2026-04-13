// Figma 매칭: [금융 리포트 — FinanceReportScreen]
/**
 * FinanceReportScreen.tsx
 * Step 5: 갓생점수 기반 금리 우대 리포트
 *
 * 구성:
 *  - 상단 배너: "갓생점수 XXX점을 대출 금리에 반영하였습니다"
 *  - 금리 비교 카드: 기존 금리 → 인하폭 → 최종 금리 시각화
 *  - SHAP 기여도 Top 5 리스트
 *  - 신용 등급 변화 타임라인
 *  - "하나은행 신용대출 바로가기" CTA 버튼
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectSHAPValues,
} from '../../application/stores/godScoreStore';

// ── 금리 계산 로직 ─────────────────────────────────────────────────
function calcRateDiscount(score: number): {
  baseRate: number;
  discount: number;
  finalRate: number;
  tierLabel: string;
} {
  // 갓생점수 → 금리 인하폭 (최대 1.5%p)
  const discount    = Math.min(Math.max((score - 40) / 60 * 1.5, 0), 1.5);
  const baseRate    = 5.8;
  const finalRate   = Math.max(baseRate - discount, 2.5);
  const tierLabel   = score >= 80 ? '최우수' : score >= 60 ? '우수' : score >= 40 ? '일반' : '기본';
  return {
    baseRate:  Math.round(baseRate  * 10) / 10,
    discount:  Math.round(discount  * 100) / 100,
    finalRate: Math.round(finalRate * 10) / 10,
    tierLabel,
  };
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

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: 1,
      duration: 1000,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  const discountPct = discount / baseRate;
  const barWidth    = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['100%', `${Math.round((1 - discountPct) * 100)}%`] });

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 그린 헤더 */}
      <View className="bg-green-500 px-5 py-5">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-white/80 text-xs font-medium mb-1">갓생점수 반영 결과</Text>
            <Text className="text-white text-xl font-black leading-tight">
              {score}점으로{'\n'}{tierLabel} 금리 적용
            </Text>
          </View>
          <View className="bg-white/20 rounded-2xl px-4 py-3 items-center">
            <Text className="text-white/70 text-xs">최종 금리</Text>
            <Text className="text-white text-3xl font-black mt-0.5">{finalRate}%</Text>
          </View>
        </View>
      </View>

      {/* 금리 시각화 */}
      <View className="p-5">
        {/* 기존 금리 바 */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-xs font-semibold text-gray-500">기존 금리 (신용점수 기반)</Text>
            <Text className="text-sm font-black text-gray-400">{baseRate}%</Text>
          </View>
          <View className="h-10 bg-gray-100 rounded-xl overflow-hidden">
            <View className="h-full bg-gray-300 w-full rounded-xl items-center justify-center">
              <Text className="text-gray-600 text-sm font-bold">{baseRate}% (기존)</Text>
            </View>
          </View>
        </View>

        {/* 인하폭 화살표 */}
        <View className="flex-row items-center justify-center gap-3 my-1">
          <View className="flex-1 h-px bg-gray-100" />
          <View className="bg-green-50 border border-green-200 rounded-full px-4 py-1.5">
            <Text className="text-green-700 text-sm font-black">▼ {discount}%p 인하</Text>
          </View>
          <View className="flex-1 h-px bg-gray-100" />
        </View>

        {/* 최종 금리 바 (애니메이션) */}
        <View className="mt-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-xs font-semibold text-green-600">갓생점수 반영 금리</Text>
            <Text className="text-sm font-black text-green-600">{finalRate}%</Text>
          </View>
          <View className="h-10 bg-green-50 rounded-xl overflow-hidden border border-green-100">
            <Animated.View
              className="h-full bg-green-500 rounded-xl items-center justify-center"
              style={{ width: barWidth }}
            >
              <Text className="text-white text-sm font-black">{finalRate}% 최종</Text>
            </Animated.View>
          </View>
        </View>

        {/* 절약 안내 */}
        <View className="mt-4 bg-amber-50 rounded-2xl p-3 border border-amber-100">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">💰</Text>
            <View>
              <Text className="text-xs font-black text-amber-800">
                1억원 기준, 연간 {Math.round(discount * 100 * 10000).toLocaleString()}원 절약
              </Text>
              <Text className="text-xs text-amber-600 mt-0.5">갓생을 살아서 얻은 특별 우대 혜택입니다</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── SHAP 기여도 리스트 ────────────────────────────────────────────
function SHAPContributionCard({ shapValues }: { shapValues: any[] }) {
  const top5 = [...shapValues]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  const maxAbs = Math.max(...top5.map(s => Math.abs(s.value)), 1);

  const FEATURE_EMOJI: Record<string, string> = {
    A_1: '⏰', A_2: '😴', A_3: '📅', A_4: '✅',
    B_1: '💼', B_2: '💵', B_3: '📈', B_4: '⭐',
    C_1: '💳', C_2: '🌙', C_3: '🛒', C_4: '🏦',
    D_1: '🏃', D_2: '🚌', D_3: '⚡', D_4: '🤝',
  };

  if (top5.length === 0) {
    return (
      <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 p-5 items-center">
        <Text className="text-gray-400 text-sm">갓생점수를 먼저 계산해주세요</Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <View className="px-5 pt-5 pb-3 border-b border-gray-50">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-blue-50 rounded-xl items-center justify-center">
            <Text className="text-sm">🧠</Text>
          </View>
          <View>
            <Text className="text-base font-bold text-gray-800">AI 점수 기여도 분석</Text>
            <Text className="text-xs text-gray-400">금리 산정에 가장 큰 영향을 준 요인 Top 5</Text>
          </View>
        </View>
      </View>

      <View className="p-5 gap-3">
        {top5.map((shap, idx) => {
          const isPositive = shap.value >= 0;
          const barPct     = Math.abs(shap.value) / maxAbs;
          const emoji      = FEATURE_EMOJI[shap.featureId] ?? '📊';
          return (
            <View key={shap.featureId}>
              <View className="flex-row items-center gap-2 mb-1.5">
                <Text className="text-gray-400 text-xs w-4">{idx + 1}</Text>
                <Text className="text-base">{emoji}</Text>
                <Text className="text-xs font-semibold text-gray-700 flex-1">
                  {shap.featureName ?? shap.featureId}
                </Text>
                <View className={`px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Text className={`text-xs font-black ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{shap.value.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden ml-10">
                <View
                  className={`h-full rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.round(barPct * 100)}%` }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── 신용 등급 변화 타임라인 ───────────────────────────────────────
function CreditTimelineCard({ score }: { score: number }) {
  const TIMELINE = [
    { month: '3개월 전',  score: Math.max(score - 22, 30), label: '시작' },
    { month: '2개월 전',  score: Math.max(score - 14, 35), label: '' },
    { month: '1개월 전',  score: Math.max(score - 6,  40), label: '' },
    { month: '현재',      score: Math.round(score),         label: '현재' },
  ];

  const maxScore = Math.max(...TIMELINE.map(t => t.score));

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <View className="px-5 pt-5 pb-3 border-b border-gray-50">
        <Text className="text-base font-bold text-gray-800">📈 갓생점수 성장 추이</Text>
        <Text className="text-xs text-gray-400 mt-0.5">꾸준한 미션 달성으로 점수가 향상되고 있습니다</Text>
      </View>

      <View className="p-5">
        {/* 미니 차트 */}
        <View className="flex-row items-end justify-around h-20 mb-3">
          {TIMELINE.map((t, i) => {
            const heightPct = maxScore > 0 ? t.score / maxScore : 0;
            const isLast    = i === TIMELINE.length - 1;
            return (
              <View key={i} className="items-center gap-1" style={{ flex: 1 }}>
                <Text className="text-xs font-bold text-gray-600">{t.score}</Text>
                <View
                  className={`w-7 rounded-t-lg ${isLast ? 'bg-green-500' : 'bg-gray-200'}`}
                  style={{ height: Math.max(heightPct * 60, 8) }}
                />
              </View>
            );
          })}
        </View>

        {/* 월 레이블 */}
        <View className="flex-row justify-around">
          {TIMELINE.map((t, i) => (
            <Text key={i} className="text-xs text-gray-400 text-center flex-1">
              {t.month}
            </Text>
          ))}
        </View>

        <View className="mt-3 flex-row items-center gap-2 bg-green-50 rounded-xl p-3">
          <Text className="text-lg">🚀</Text>
          <Text className="text-xs text-green-700 font-semibold flex-1">
            최근 3개월 +{Math.round(score - Math.max(score - 22, 30))}점 상승 · 계속 성장 중입니다!
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function FinanceReportScreen() {
  const score      = useGodScoreStore(selectCurrentScore);
  const shapValues = useGodScoreStore(selectSHAPValues);
  const seedMock   = useGodScoreStore(s => s.seedMockData);

  useEffect(() => {
    seedMock('user_001');
  }, []);

  const { baseRate, discount, finalRate, tierLabel } = calcRateDiscount(Math.round(score));

  const handleCTA = () => {
    Alert.alert(
      '하나은행 신용대출',
      `갓생점수 ${Math.round(score)}점 적용\n최종 금리 ${finalRate}% 우대 혜택으로\n하나은행 앱에서 신청할 수 있습니다.`,
      [
        { text: '닫기', style: 'cancel' },
        { text: '앱으로 이동', onPress: () => Linking.openURL('https://www.kebhana.com') },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-hana-lightgray" edges={['top']}>
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
        <View className="mx-4 mt-4 bg-gradient-to-r from-green-600 to-emerald-500 rounded-3xl overflow-hidden">
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
                <Text className="text-white text-xs font-semibold">{tierLabel} 등급</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 금리 비교 카드 ── */}
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
          <Text className="text-white/80 text-xs mt-0.5">최종 금리 {finalRate}% 우대 적용</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Figma 매칭: [금융 리포트 — 18:1588]
/**
 * FinanceReportScreen.tsx — inline style 통일 버전
 * - 헤더: 다른 화면과 동일한 inline style + 로컬 코인 PNG + pointBalance 연동
 * - 금리 인하 폭: 실제 계산값 표시 (discount.toFixed(2)%p 인하)
 * - 타임라인: rotated View 세그먼트로 점 연결선 복원
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGodScoreStore } from '../../application/stores/godScoreStore';
import { useMissionStore } from '../../application/stores/missionStore';

const { width: SCREEN_W } = Dimensions.get('window');
const S = (n: number): number => Math.round((Math.min(SCREEN_W, 480) / 390) * n);

// ── 에셋 ─────────────────────────────────────────────────────
const IMG = {
  border:       { uri: 'https://www.figma.com/api/mcp/asset/63553d0a-95db-4d81-80a7-997e83735c64' },
  coin:         require('../../../assets/images/coin.png'),
  bankIcon:     { uri: 'https://www.figma.com/api/mcp/asset/fec7ab96-a289-41e0-8785-80c04e0e6f9d' },
  ellipseRed:   { uri: 'https://www.figma.com/api/mcp/asset/a55e7c10-7ba0-4016-84c9-c187a423a0cf' },
  ellipseGreen: { uri: 'https://www.figma.com/api/mcp/asset/63cd7fde-0f5c-4a53-886e-8f10b9152dc4' },
  arrow:        { uri: 'https://www.figma.com/api/mcp/asset/a6966311-f975-4c2a-a33c-2c4fed92058c' },
};

// ── 타임라인 ──────────────────────────────────────────────────
const TIMELINE_DATA = [
  { label: '3개월 전', score: 415 },
  { label: '2개월 전', score: 425 },
  { label: '1개월 전', score: 429 },
  { label: '현재',     score: 437 },
];
const TL_MIN = 400;
const TL_MAX = 450;
const CHART_H = S(120); // 차트 영역 높이 (점 위치 계산용)
const DOT_R   = S(6);   // 점 반지름
// 차트 실제 너비: 캡된 SCREEN_W 기준 (패딩 제외)
const CHART_W = Math.min(SCREEN_W, 480) - S(13) * 2 - S(40);

function normalizeScore(s: number): number {
  return Math.max(0, Math.min(1, (s - TL_MIN) / (TL_MAX - TL_MIN)));
}

// ── 점수 → 등급 ──────────────────────────────────────────────
function getTierLabel(score: number): string {
  if (score < 400) return '새싹';
  if (score < 600) return '성실';
  if (score < 850) return '갓생';
  return '레전드';
}

export default function FinanceReportScreen(): React.JSX.Element {
  const { currentSnapshot } = useGodScoreStore();
  const { pointBalance }    = useMissionStore();

  const currentScore = currentSnapshot?.breakdown.totalScore ?? 437;
  const scoreLevel   = getTierLabel(currentScore);

  // 금리 계산: 100점당 0.1%p, 최대 1.0%p
  const baseRate = 4.25;
  const discount = parseFloat(Math.min((currentScore / 1000) * 1.0, 1.0).toFixed(2));
  const finalRate = parseFloat((baseRate - discount).toFixed(2));

  // 입장 애니메이션
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f2ed' }}>

      {/* ── 헤더 (다른 화면과 동일한 inline style) ─────────── */}
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
              {pointBalance}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S(60) }}>

        {/* ── 타이틀 ─────────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginTop: S(24), marginBottom: S(16) }}>
          <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#006b58', fontSize: S(32), lineHeight: S(30) }}>
            금융 리포트
          </Text>
          <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), marginTop: S(8) }}>
            당신의 성장을 응원합니다.
          </Text>
        </View>

        {/* ── 금리 비교 카드 ───────────────────────────── */}
        <View style={{
          marginHorizontal: S(13), backgroundColor: 'rgba(255,255,255,0.8)',
          borderRadius: S(15), paddingTop: S(20), paddingBottom: S(24), paddingHorizontal: S(34),
          shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4,
        }}>
          {/* 점수 반영 문구 */}
          <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), textAlign: 'center', marginBottom: S(20) }}>
            {'대출 금리에 '}
            <Text style={{ fontFamily: 'Hana2-Heavy', color: '#006b58', fontSize: S(20) }}>{currentScore}</Text>
            {`점(${scoreLevel})을 반영하였습니다.`}
          </Text>

          {/* 금리 비교 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {/* 현재 기준 금리 */}
            <View style={{ alignItems: 'center', width: S(110) }}>
              <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#1c1c19', fontSize: S(12), marginBottom: S(12) }}>
                현재 기준 금리
              </Text>
              <View style={{ width: S(100), height: S(100) }}>
                <Image source={IMG.ellipseRed} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="contain" />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Hana2-Heavy', color: '#ba3200', fontSize: S(24), lineHeight: S(28) }}>
                    {baseRate.toFixed(2)}<Text style={{ fontSize: S(13) }}>%</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* 화살표 + 실제 인하 폭 */}
            <View style={{ alignItems: 'center', marginHorizontal: S(8) }}>
              <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#ba3200', fontSize: S(10), marginBottom: S(4) }}>
                {discount.toFixed(2)}%p 인하
              </Text>
              <Image source={IMG.arrow} style={{ width: S(38), height: S(15) }} resizeMode="contain" />
            </View>

            {/* 최종 금리 */}
            <View style={{ alignItems: 'center', width: S(110) }}>
              <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#1c1c19', fontSize: S(12), marginBottom: S(12) }}>
                최종 금리
              </Text>
              <View style={{ width: S(100), height: S(100) }}>
                <Image source={IMG.ellipseGreen} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="contain" />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Hana2-Heavy', color: '#006b58', fontSize: S(24), lineHeight: S(28) }}>
                    {finalRate.toFixed(2)}<Text style={{ fontSize: S(13) }}>%</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── 신용 성장 타임라인 카드 ──────────────────── */}
        <View style={{
          marginHorizontal: S(13), marginTop: S(16),
          backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: S(15),
          paddingTop: S(16), paddingBottom: S(24), paddingHorizontal: S(20),
          shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4,
        }}>
          <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: S(15), marginBottom: S(16) }}>
            📈 신용 성장 타임라인
          </Text>

          {/* 차트 영역 */}
          <View style={{
            backgroundColor: 'rgba(207,255,247,0.22)', borderRadius: S(5),
            height: CHART_H + S(48), // 점 + 점수 텍스트 + 레이블 공간
            paddingHorizontal: S(10), paddingTop: S(24), paddingBottom: S(24),
          }}>
            {/* 점들과 연결선을 하나의 상대 레이아웃으로 구성 */}
            <View style={{ height: CHART_H, position: 'relative' }}>
              {TIMELINE_DATA.map((pt, i) => {
                const n = TIMELINE_DATA.length;
                // x: 0~1 위치 (점 중앙)
                const xRatio = (i * 2 + 1) / (n * 2);
                // y: 위→아래 (0=top, 1=bottom), 높이가 높을수록 y 작음
                const yRatio = 1 - normalizeScore(pt.score);

                const xPx = xRatio * CHART_W; // 캡된 너비 기준
                const yPx = yRatio * CHART_H;

                // 이전 점과의 연결선
                let lineEl: React.ReactElement | null = null;
                if (i > 0) {
                  const prev = TIMELINE_DATA[i - 1];
                  const prevX = ((i - 1) * 2 + 1) / (n * 2) * CHART_W;
                  const prevY = (1 - normalizeScore(prev.score)) * CHART_H;
                  const dx = xPx - prevX;
                  const dy = yPx - prevY;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                  lineEl = (
                    <View key={`line-${i}`} style={{
                      position: 'absolute',
                      width: len,
                      height: S(2),
                      backgroundColor: '#006b58',
                      left: prevX + dx / 2 - len / 2,
                      top: prevY + dy / 2 - S(1),
                      transform: [{ rotate: `${angle}deg` }],
                      opacity: 0.7,
                    }} />
                  );
                }

                return (
                  <React.Fragment key={`pt-${i}`}>
                    {lineEl}
                    {/* 점수 텍스트 (점 위) */}
                    <Text style={{
                      position: 'absolute',
                      left: xPx - S(20),
                      top: yPx - S(22),
                      width: S(40),
                      textAlign: 'center',
                      fontFamily: 'Paperlogy-SemiBold',
                      color: '#006b58',
                      fontSize: S(11),
                    }}>
                      {pt.score}
                    </Text>
                    {/* 점 (원) */}
                    <View style={{
                      position: 'absolute',
                      width: DOT_R * 2,
                      height: DOT_R * 2,
                      borderRadius: DOT_R,
                      backgroundColor: i === TIMELINE_DATA.length - 1 ? '#006b58' : '#a3c9a5',
                      left: xPx - DOT_R,
                      top: yPx - DOT_R,
                      shadowColor: '#006b58',
                      shadowOpacity: i === TIMELINE_DATA.length - 1 ? 0.4 : 0,
                      shadowRadius: 4,
                    }} />
                    {/* 레이블 텍스트 (점 아래) */}
                    <Text style={{
                      position: 'absolute',
                      left: xPx - S(24),
                      top: CHART_H + S(6),
                      width: S(48),
                      textAlign: 'center',
                      fontFamily: 'Paperlogy-Regular',
                      color: '#1c1c19',
                      fontSize: S(11),
                    }}>
                      {pt.label}
                    </Text>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 하나은행 신용 대출 카드 ─────────────────── */}
        <View style={{
          marginHorizontal: S(13), marginTop: S(16),
          backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: S(15),
          paddingTop: S(28), paddingBottom: S(16), paddingHorizontal: S(39),
          alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4,
        }}>
          <Image source={IMG.bankIcon} style={{ width: S(30), height: S(30), marginBottom: S(12) }} resizeMode="contain" />
          <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#383835', fontSize: S(20), textAlign: 'center', marginBottom: S(16) }}>
            하나은행 신용 대출
          </Text>
          <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), textAlign: 'center', lineHeight: S(20), marginBottom: S(28) }}>
            <Text style={{ fontFamily: 'Hana2-Bold', color: '#006b58' }}>하나 더</Text>
            {' 전용 우대 금리\n생활 패턴 맞춤형 상품 추천 서비스'}
          </Text>
          <TouchableOpacity style={{
            width: '100%', backgroundColor: 'rgba(242,237,229,0.87)',
            borderRadius: S(23), height: S(43),
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5,
          }}>
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#008485', fontSize: S(16) }}>
              하나 긱 워커 대출 바로가기 →
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

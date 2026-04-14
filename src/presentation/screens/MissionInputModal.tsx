// Figma 매칭: [세부 미션 수행 — 인라인 제출 모달]
/**
 * MissionInputModal.tsx
 * 파일 업로드 없이 처리되는 미션들의 인증 UI.
 *
 * 미션 유형별 UI:
 *   INSTANT  — 현재 시각 자동 제출 (A_1 기상, A_3 출석 체크인)
 *   DURATION — 숫자 입력 (A_2 수면시간, D_1 운동)
 *   MYDATA   — 마이데이터 자동 연동 안내 후 확인 (B_2, B_3, C_1~C_4, D_2)
 *
 * 사용:
 *   <MissionInputModal
 *     visible={visible}
 *     missionId="A_1"
 *     onClose={() => setVisible(false)}
 *     onSubmit={handleRawData}
 *   />
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import type { MissionFeatureId } from '../../../types/features';

// ── 미션 유형 정의 ────────────────────────────────────────────────

type MissionSubmitType = 'INSTANT' | 'DURATION' | 'MYDATA';

interface MissionSubmitConfig {
  type:        MissionSubmitType;
  title:       string;
  description: string;
  emoji:       string;
  // DURATION 타입에서만 사용
  inputLabel?:    string;
  inputUnit?:     string;
  inputKey?:      string;
  inputMin?:      number;
  inputMax?:      number;
  inputDefault?:  string;
  // MYDATA 타입에서만 사용
  dataSource?:    string;
  dataFields?:    string[];
}

const MISSION_SUBMIT_CONFIG: Record<string, MissionSubmitConfig> = {
  // ── fA: 생활 루틴 ──────────────────────────────────────────────
  A_1: {
    type: 'INSTANT',
    title: '기상 인증',
    description: '현재 시각을 기상 시각으로 자동 기록합니다.',
    emoji: '⏰',
  },
  A_2: {
    type: 'DURATION',
    title: '수면 규칙성',
    description: '어젯밤 수면 시간을 입력하세요. 7~8시간이 최고점입니다.',
    emoji: '😴',
    inputLabel: '수면 시간',
    inputUnit: '분',
    inputKey: 'sleep_duration_min',
    inputMin: 0,
    inputMax: 720,
    inputDefault: '420',
  },
  A_3: {
    type: 'INSTANT',
    title: '앱 출석 체크인',
    description: '오늘 앱 출석을 기록합니다.',
    emoji: '📅',
  },
  A_4: {
    type: 'MYDATA',
    title: '미션 달성률',
    description: '오늘 완료한 미션 수를 자동으로 집계합니다.',
    emoji: '✅',
    dataSource: '앱 미션 로그',
    dataFields: ['완료 미션 수', '전체 활성 미션 수'],
  },

  // ── fB: 일·소득 ───────────────────────────────────────────────
  B_2: {
    type: 'MYDATA',
    title: '월 수입 변동성',
    description: '최근 6개월 입금 내역을 마이데이터에서 자동으로 불러옵니다.',
    emoji: '💵',
    dataSource: '마이데이터 표준 API',
    dataFields: ['최근 6개월 월별 입금액', '변동계수(CV)'],
  },
  B_3: {
    type: 'MYDATA',
    title: '수입 예측 가능성',
    description: 'Prophet 모델로 당월 예측 수입 대비 실제 수입을 비교합니다.',
    emoji: '📈',
    dataSource: '마이데이터 표준 API',
    dataFields: ['실제 수입', '예측 수입 (Prophet)', 'MAPE'],
  },

  // ── fC: 소비 행동 ─────────────────────────────────────────────
  C_1: {
    type: 'MYDATA',
    title: '소비 패턴 규칙성',
    description: '이번 달 결제 내역의 금액 분포를 분석합니다.',
    emoji: '💳',
    dataSource: '마이데이터 표준 API',
    dataFields: ['결제 금액 목록', '변동계수(CV)'],
  },
  C_2: {
    type: 'MYDATA',
    title: '새벽 충동 결제 감지',
    description: '어젯밤 00:00~06:00 결제 내역을 자동으로 확인합니다.',
    emoji: '🌙',
    dataSource: '마이데이터 표준 API',
    dataFields: ['새벽 결제 횟수', '새벽 결제 총액'],
  },
  C_3: {
    type: 'MYDATA',
    title: '식료품 구매 인증',
    description: '이번 달 마트·식료품 결제 횟수를 자동으로 집계합니다.',
    emoji: '🛒',
    dataSource: '마이데이터 표준 API',
    dataFields: ['식료품/마트 결제 횟수'],
  },
  C_4: {
    type: 'MYDATA',
    title: '잔고 유지 여부',
    description: '월 평균 잔고가 고정 지출 대비 충분한지 확인합니다.',
    emoji: '🏦',
    dataSource: '마이데이터 표준 API',
    dataFields: ['월 평균 잔고', '고정 지출 합계'],
  },

  // ── fD: 개인 ESG ──────────────────────────────────────────────
  D_1: {
    type: 'DURATION',
    title: '운동·자기관리',
    description: '오늘 걸음수 또는 운동 시간을 입력하세요.',
    emoji: '🏃',
    inputLabel: '오늘 걸음수',
    inputUnit: '보',
    inputKey: 'daily_steps',
    inputMin: 0,
    inputMax: 50000,
    inputDefault: '5000',
  },
  D_2: {
    type: 'MYDATA',
    title: '대중교통·친환경 소비',
    description: '버스, 지하철, 따릉이 등 친환경 결제 내역을 자동으로 집계합니다.',
    emoji: '🚌',
    dataSource: '마이데이터 표준 API',
    dataFields: ['친환경 결제 횟수', '전체 결제 대비 비율'],
  },
};

// ── 컴포넌트 ─────────────────────────────────────────────────────

interface MissionInputModalProps {
  visible:    boolean;
  missionId:  MissionFeatureId;
  onClose:    () => void;
  /** rawData JSON 문자열 + AI 점수를 부모에게 전달 */
  onSubmit:   (rawDataJson: string, aiScore: number) => Promise<void>;
}

export default function MissionInputModal({
  visible,
  missionId,
  onClose,
  onSubmit,
}: MissionInputModalProps) {
  const config = MISSION_SUBMIT_CONFIG[missionId];
  const [inputValue, setInputValue]   = useState(config?.inputDefault ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone]           = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');

  // 모달 닫힐 때 상태 리셋
  const handleClose = useCallback(() => {
    setInputValue(config?.inputDefault ?? '');
    setIsSubmitting(false);
    setIsDone(false);
    setErrorMsg('');
    onClose();
  }, [config, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!config) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let rawData: Record<string, unknown> = {};
      const now = new Date().toISOString();

      if (config.type === 'INSTANT') {
        // A_1 기상: 현재 UTC 시각
        // A_3 체크인: 현재 UTC 시각
        rawData = missionId === 'A_1'
          ? { wake_time_utc: now }
          : { checkin_time_utc: now };
      } else if (config.type === 'DURATION') {
        const numVal = parseInt(inputValue, 10);
        if (isNaN(numVal) || numVal < (config.inputMin ?? 0)) {
          setErrorMsg(`${config.inputLabel}: ${config.inputMin}${config.inputUnit} 이상 입력해주세요.`);
          setIsSubmitting(false);
          return;
        }
        // D_1 운동의 경우 걸음수와 운동시간 둘 다 지원
        if (missionId === 'D_1') {
          rawData = {
            daily_steps:      numVal,
            exercise_minutes: Math.round(numVal / 100),  // 걸음수 → 대략 환산
          };
        } else {
          rawData = { [config.inputKey!]: numVal };
        }
      } else {
        // MYDATA: Mock 합성 데이터 생성
        rawData = buildMockMyDataPayload(missionId);
      }

      // 부모(MissionCenterScreen)에게 위임
      await onSubmit(JSON.stringify(rawData), 80 + Math.random() * 18);
      setIsDone(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '제출 실패. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }, [config, inputValue, missionId, onSubmit]);

  if (!config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* 배경 오버레이 */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />

        {/* 바텀시트 */}
        <View style={{
          backgroundColor: 'white',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 40,
          minHeight: 320,
        }}>
          {/* 핸들 바 */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 }} />

          {isDone ? (
            /* ── 완료 상태 ── */
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>🎉</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 6 }}>
                인증 완료!
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                갓생점수에 반영되었습니다
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={{ backgroundColor: '#00A651', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40 }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>확인</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── 입력 상태 ── */
            <>
              {/* 헤더 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 16,
                  backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Text style={{ fontSize: 28 }}>{config.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937' }}>{config.title}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{config.description}</Text>
                </View>
              </View>

              {config.type === 'INSTANT' && (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: '#065F46', fontWeight: '600', marginBottom: 4 }}>
                    📍 자동 기록 정보
                  </Text>
                  <Text style={{ fontSize: 13, color: '#059669' }}>
                    현재 시각: {new Date().toLocaleTimeString('ko-KR')}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                    확인 버튼을 누르면 현재 시각이 자동으로 기록됩니다
                  </Text>
                </View>
              )}

              {config.type === 'DURATION' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    {config.inputLabel}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TextInput
                      value={inputValue}
                      onChangeText={setInputValue}
                      keyboardType="numeric"
                      placeholder={config.inputDefault}
                      style={{
                        flex: 1,
                        borderWidth: 2,
                        borderColor: '#D1FAE5',
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        fontSize: 20,
                        fontWeight: '700',
                        textAlign: 'center',
                        color: '#1F2937',
                      }}
                    />
                    <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600' }}>
                      {config.inputUnit}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                    권장: {config.inputMin}~{config.inputMax} {config.inputUnit}
                  </Text>
                </View>
              )}

              {config.type === 'MYDATA' && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8', marginBottom: 8 }}>
                      📡 {config.dataSource}에서 자동 수집
                    </Text>
                    {(config.dataFields ?? []).map((field, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', marginRight: 8 }} />
                        <Text style={{ fontSize: 12, color: '#1E40AF' }}>{field}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#92400E' }}>
                      ⚠️ Mock 모드: 실제 마이데이터 연동 시 실제 데이터가 사용됩니다
                    </Text>
                  </View>
                </View>
              )}

              {errorMsg ? (
                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: '#DC2626' }}>⚠️ {errorMsg}</Text>
                </View>
              ) : null}

              {/* 제출 버튼 */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={{
                  backgroundColor: isSubmitting ? '#D1FAE5' : '#00A651',
                  borderRadius: 18,
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
                activeOpacity={0.85}
              >
                {isSubmitting
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>
                      {config.type === 'INSTANT'  ? '✅ 지금 기록하기' :
                       config.type === 'DURATION' ? '📊 제출 및 점수 반영' :
                                                     '🔄 마이데이터 연동 및 제출'}
                    </Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Mock 마이데이터 페이로드 ──────────────────────────────────────
function buildMockMyDataPayload(missionId: string): Record<string, unknown> {
  const now = new Date();
  switch (missionId) {
    case 'A_4': return { completed_count: 3,  total_active: 4 };
    case 'B_2': return { monthly_incomes: [2800000, 3100000, 2950000, 3200000, 2700000, 3050000] };
    case 'B_3': return { actual_income: 3050000, predicted_income: 2980000 };
    case 'C_1': return { transaction_amounts: [45000, 23000, 67000, 12000, 89000, 34000, 55000] };
    case 'C_2': return { midnight_transaction_count: Math.floor(Math.random() * 3) };
    case 'C_3': return { grocery_count_this_month: Math.floor(Math.random() * 5) + 1 };
    case 'C_4': return { avg_balance: 1850000, fixed_expenses: 950000 };
    case 'D_2': return { eco_transaction_count: Math.floor(Math.random() * 8) + 2, total_transaction_count: 35 };
    default:     return { ts: now.toISOString() };
  }
}

// Figma 매칭: [세부 미션 수행 — MissionUploadScreen]
/**
 * MissionUploadScreen.tsx
 * Step 3: 작업물 업로드 + AI 분석 진행
 *
 * 구성:
 *  - 상단: 미션 정보 헤더 (미션명 + 카테고리 + 예상 획득 코인)
 *  - 중단: 작업물 업로드 카드 (파일 선택 버튼, 용량 안내, 미리보기)
 *  - 하단: AI 분석 진행 카드 (단계별 로딩 애니메이션 + 진척도)
 *  - 완료 시: 블록체인 등록 결과 + 획득 코인 애니메이션
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMissionStore } from '../../application/stores/missionStore';
import type { MissionFeatureId } from '../../../types/features';
import { MISSION_DEFINITIONS } from '../../domain/entities/Mission';

// ── 웹 안전 Alert ──────────────────────────────────────────────────
function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}



// ── 미션 ID → 이모지 매핑 ─────────────────────────────────────────
const MISSION_EMOJI: Record<string, string> = {
  A_1: '⏰', A_2: '😴', A_3: '📅', A_4: '✅',
  B_1: '💼', B_2: '💵', B_3: '📈', B_4: '⭐',
  C_1: '💳', C_2: '🌙', C_3: '🛒', C_4: '🏦',
  D_1: '🏃', D_2: '🚌', D_3: '⚡', D_4: '🤝',
};


// ── 상수 ──────────────────────────────────────────────────────────
const MOCK_USER_ID = 'user_001';

const AI_STEPS = [
  { label: '파일 검증 중',        emoji: '📂', duration: 800  },
  { label: 'AI 진위 분석 중',     emoji: '🤖', duration: 1200 },
  { label: '행동 점수 산출 중',   emoji: '📊', duration: 900  },
  { label: 'keccak256 해싱',      emoji: '🔐', duration: 600  },
  { label: '블록체인 등록 중',    emoji: '⛓️', duration: 1000 },
];

const FILE_TYPES = [
  { label: 'PDF',   emoji: '📄', color: 'bg-red-50 border-red-200 text-red-600'    },
  { label: '이미지', emoji: '🖼️', color: 'bg-blue-50 border-blue-200 text-blue-600' },
  { label: '영수증', emoji: '🧾', color: 'bg-amber-50 border-amber-200 text-amber-600' },
  { label: '링크',  emoji: '🔗', color: 'bg-purple-50 border-purple-200 text-purple-600' },
];

// ── 업로드 파일 카드 ───────────────────────────────────────────────
function FileUploadCard({
  selectedFileType,
  onSelectFileType,
  onUpload,
  isUploading,
  uploadedFileName,
}: {
  selectedFileType: number | null;
  onSelectFileType: (idx: number) => void;
  onUpload: () => void;
  isUploading: boolean;
  uploadedFileName: string | null;
}) {
  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <View className="px-5 pt-5 pb-3 border-b border-gray-50">
        <View className="flex-row items-center gap-2">
          <View className="w-9 h-9 bg-green-50 rounded-xl items-center justify-center">
            <Text className="text-lg">📎</Text>
          </View>
          <View>
            <Text className="text-base font-bold text-gray-800">작업물 업로드</Text>
            <Text className="text-xs text-gray-400">최대 10MB · PDF, JPG, PNG, 영수증 지원</Text>
          </View>
        </View>
      </View>

      <View className="p-5">
        {/* 파일 형식 선택 칩 */}
        <Text className="text-xs font-semibold text-gray-500 mb-2.5">파일 형식 선택</Text>
        <View className="flex-row gap-2 mb-4 flex-wrap">
          {FILE_TYPES.map((ft, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => onSelectFileType(idx)}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                selectedFileType === idx
                  ? ft.color
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              <Text className="text-sm">{ft.emoji}</Text>
              <Text className={`text-xs font-semibold ${
                selectedFileType === idx ? '' : 'text-gray-500'
              }`}>{ft.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 업로드 드롭존 */}
        {uploadedFileName ? (
          <View className="bg-green-50 border-2 border-green-200 border-dashed rounded-2xl p-5 items-center">
            <Text className="text-3xl mb-2">✅</Text>
            <Text className="text-sm font-bold text-green-700">{uploadedFileName}</Text>
            <Text className="text-xs text-green-500 mt-1">업로드 완료</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onUpload}
            disabled={isUploading || selectedFileType === null}
            activeOpacity={0.8}
            className={`border-2 border-dashed rounded-2xl p-6 items-center ${
              selectedFileType !== null
                ? 'border-green-300 bg-green-50/50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            {isUploading ? (
              <ActivityIndicator size="large" color="#00A651" />
            ) : (
              <>
                <Text className="text-4xl mb-3">
                  {selectedFileType !== null ? FILE_TYPES[selectedFileType].emoji : '📁'}
                </Text>
                <Text className={`text-sm font-bold ${
                  selectedFileType !== null ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {selectedFileType !== null
                    ? '탭하여 파일 선택'
                    : '파일 형식을 먼저 선택하세요'}
                </Text>
                <Text className="text-xs text-gray-400 mt-1">또는 여기에 파일을 끌어다 놓으세요</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* 주의 사항 */}
        <View className="mt-3 flex-row items-start gap-2 bg-amber-50 rounded-xl p-3">
          <Text className="text-sm">⚠️</Text>
          <Text className="text-xs text-amber-700 flex-1 leading-relaxed">
            AI가 업로드한 파일의 진위를 분석합니다. 허위 자료 제출 시 점수가 차감될 수 있습니다.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── AI 분석 진행 카드 ─────────────────────────────────────────────
function AIAnalysisCard({
  isActive,
  currentStep,
  totalSteps,
  aiScore,
  txHash,
}: {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  aiScore: number | null;
  txHash: string | null;
}) {
  const progress = totalSteps > 0 ? currentStep / totalSteps : 0;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive]);

  if (!isActive && !txHash) return null;

  return (
    <View className="mx-4 mt-4 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 완료 상태 */}
      {txHash ? (
        <View className="p-5">
          <View className="items-center mb-4">
            <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-3">
              <Text className="text-3xl">🎉</Text>
            </View>
            <Text className="text-lg font-black text-gray-800">인증 완료!</Text>
            <Text className="text-sm text-gray-400 mt-0.5">블록체인에 영구 기록되었습니다</Text>
          </View>

          {/* AI 점수 */}
          {aiScore !== null && (
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 bg-blue-50 rounded-2xl p-3 items-center">
                <Text className="text-xs text-blue-500 font-semibold">AI 진실성 점수</Text>
                <Text className="text-2xl font-black text-blue-700 mt-1">{Math.round(aiScore)}</Text>
                <Text className="text-xs text-blue-400">/100</Text>
              </View>
              <View className="flex-1 bg-green-50 rounded-2xl p-3 items-center">
                <Text className="text-xs text-green-500 font-semibold">획득 포인트</Text>
                <Text className="text-2xl font-black text-green-700 mt-1">+50</Text>
                <Text className="text-xs text-green-400">🪙 코인</Text>
              </View>
            </View>
          )}

          {/* 블록체인 해시 */}
          <View className="bg-gray-900 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-sm">⛓️</Text>
              <Text className="text-xs font-bold text-green-400">TX Hash</Text>
              <View className="ml-auto bg-green-900/50 rounded-full px-2 py-0.5">
                <Text className="text-xs text-green-400 font-semibold">VERIFIED</Text>
              </View>
            </View>
            <Text className="text-gray-400 text-xs font-mono leading-relaxed" numberOfLines={2}>
              {txHash}
            </Text>
          </View>
        </View>
      ) : (
        /* 분석 진행 중 */
        <View className="p-5">
          <View className="flex-row items-center gap-2 mb-4">
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center">
                <Text className="text-lg">🤖</Text>
              </View>
            </Animated.View>
            <View>
              <Text className="text-base font-bold text-gray-800">AI 분석 중...</Text>
              <Text className="text-xs text-gray-400">{currentStep} / {totalSteps} 단계 완료</Text>
            </View>
            <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 'auto' }} />
          </View>

          {/* 프로그레스 바 */}
          <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <Animated.View
              className="h-full bg-blue-400 rounded-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>

          {/* 단계별 체크리스트 */}
          {AI_STEPS.map((step, idx) => {
            const isDone    = idx < currentStep;
            const isRunning = idx === currentStep;
            return (
              <View
                key={idx}
                className={`flex-row items-center gap-3 py-2.5 px-3 rounded-xl mb-1.5 ${
                  isDone    ? 'bg-green-50' :
                  isRunning ? 'bg-blue-50'  : 'bg-gray-50'
                }`}
              >
                <View className={`w-6 h-6 rounded-full items-center justify-center ${
                  isDone    ? 'bg-green-500' :
                  isRunning ? 'bg-blue-500'  : 'bg-gray-200'
                }`}>
                  {isDone    ? <Text className="text-white text-xs font-bold">✓</Text> :
                   isRunning ? <ActivityIndicator size="small" color="white" /> :
                               <Text className="text-gray-400 text-xs">{idx + 1}</Text>}
                </View>
                <Text className="text-sm">{step.emoji}</Text>
                <Text className={`text-sm font-medium flex-1 ${
                  isDone    ? 'text-green-700' :
                  isRunning ? 'text-blue-700'  : 'text-gray-400'
                }`}>
                  {step.label}
                </Text>
                {isDone && <Text className="text-xs text-green-500">완료</Text>}
                {isRunning && <Text className="text-xs text-blue-500">진행 중</Text>}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function MissionUploadScreen({ route }: { route: any }) {
  const missionId = (route?.params?.missionId ?? 'A_1') as MissionFeatureId;
  const definition = MISSION_DEFINITIONS[missionId];

  const [selectedFileType, setSelectedFileType] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName]  = useState<string | null>(null);
  const [isUploading, setIsUploading]            = useState(false);
  const [isAnalyzing, setIsAnalyzing]            = useState(false);
  const [currentStep, setCurrentStep]            = useState(0);
  const [aiScore, setAiScore]                    = useState<number | null>(null);
  const [txHash, setTxHash]                      = useState<string | null>(null);

  const completeMission = useMissionStore(s => s.completeMission);

  // 파일 업로드 시뮬레이션
  const handleUpload = useCallback(() => {
    if (selectedFileType === null) return;
    setIsUploading(true);
    setTimeout(() => {
      const names = ['mission_proof.pdf', 'receipt_20260414.jpg', 'work_portfolio.png', 'certificate.pdf'];
      setUploadedFileName(names[selectedFileType]);
      setIsUploading(false);
    }, 1200);
  }, [selectedFileType]);

  // AI 분석 파이프라인
  const handleAnalyze = useCallback(async () => {
    if (!uploadedFileName) {
      showAlert('파일 필요', '먼저 파일을 업로드해주세요.');
      return;
    }
    setIsAnalyzing(true);
    setCurrentStep(0);

    // 단계별 딜레이 시뮬레이션
    let step = 0;
    for (const s of AI_STEPS) {
      await new Promise(r => setTimeout(r, s.duration));
      step++;
      setCurrentStep(step);
    }

    // 미션 완료 처리
    try {
      const result = await completeMission(
        MOCK_USER_ID,
        missionId,
        JSON.stringify({ file: uploadedFileName, ts: Date.now() }),
        Math.random() * 20 + 78,
      );
      setAiScore(82 + Math.random() * 15);
      setTxHash(result.txHash);
    } catch {
      showAlert('오류', '분석 처리 중 오류가 발생했습니다.');
      setIsAnalyzing(false);
    }
  }, [uploadedFileName, missionId, completeMission]);

  const catId = missionId[0] as 'A' | 'B' | 'C' | 'D';
  const catColors: Record<string, string> = {
    A: 'bg-amber-500', B: 'bg-blue-500', C: 'bg-slate-500', D: 'bg-green-500',
  };

  return (
    <SafeAreaView className="flex-1 bg-hana-lightgray" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── 미션 정보 헤더 ── */}
        <View className={`mx-4 mt-4 rounded-3xl overflow-hidden ${catColors[catId] ?? 'bg-green-500'}`}>
          <View className="p-5">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
                <Text className="text-3xl">{MISSION_EMOJI[missionId] ?? '⚡'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white/70 text-xs font-medium">미션 인증</Text>
                <Text className="text-white text-lg font-black leading-tight">
                  {definition?.name ?? missionId}
                </Text>
              </View>
              <View className="items-center bg-white/20 rounded-2xl p-2.5">
                <Text className="text-white text-xl font-black">+50</Text>
                <Text className="text-white/80 text-xs">🪙 코인</Text>
              </View>
            </View>
            <Text className="text-white/80 text-sm leading-relaxed">
              {definition?.description ?? '미션을 완료하고 작업물을 업로드하세요.'}
            </Text>
          </View>

          {/* 인증 방식 칩 */}
          <View className="flex-row gap-2 px-5 pb-4">
            {['파일 업로드', 'AI 분석', '블록체인 기록'].map((tag, i) => (
              <View key={i} className="bg-white/20 rounded-full px-3 py-1">
                <Text className="text-white text-xs font-semibold">{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 업로드 카드 ── */}
        <FileUploadCard
          selectedFileType={selectedFileType}
          onSelectFileType={setSelectedFileType}
          onUpload={handleUpload}
          isUploading={isUploading}
          uploadedFileName={uploadedFileName}
        />

        {/* ── AI 분석 카드 ── */}
        <AIAnalysisCard
          isActive={isAnalyzing}
          currentStep={currentStep}
          totalSteps={AI_STEPS.length}
          aiScore={aiScore}
          txHash={txHash}
        />

        {/* ── 제출 버튼 ── */}
        {!isAnalyzing && !txHash && (
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={!uploadedFileName}
            className={`mx-4 mt-5 py-4 rounded-2xl items-center ${
              uploadedFileName ? 'bg-green-500' : 'bg-gray-200'
            }`}
            activeOpacity={0.85}
          >
            <Text className={`font-bold text-base ${uploadedFileName ? 'text-white' : 'text-gray-400'}`}>
              🤖 AI 분석 시작 & 미션 인증
            </Text>
          </TouchableOpacity>
        )}

        {txHash && (
          <View className="mx-4 mt-4 bg-green-500 rounded-2xl py-4 items-center">
            <Text className="text-white font-bold text-base">✅ 인증 완료 · 갓생점수 반영됨</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Figma 매칭: [미션 인증 세부 — 18:1726]
/**
 * MissionUploadScreen.tsx
 * - 헤더: HomeScreen과 동일 inline style + 로컬 코인 PNG + pointBalance 연동
 * - 드롭존: 탭하면 mock 파일명 즉시 세팅 (실제 picker 없음)
 * - 업로드 버튼: 파일 유무 상관없이 즉시 AI 분석 시작
 * - AI 분석 단계: ActivityIndicator 스피너 → 순차 초록 완료 (700ms 간격)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useMissionStore } from '../../application/stores/missionStore';
import { useAuthStore } from '../../application/stores/authStore';
import type { MissionStackParamList } from '../navigation/AppNavigator';
import { MOCK_USER_ID } from '../../constants/mockData';

// ── 스케일링 ──────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const S = (n: number): number => Math.round((SCREEN_W / 390) * n);

// ── 에셋 ─────────────────────────────────────────────────────
const IMG = {
  border:    { uri: 'https://www.figma.com/api/mcp/asset/48592c39-2a45-4894-9b62-d52b64889fcf' },
  coin:      require('../../../assets/images/coin.png'),
  portfolio: { uri: 'https://www.figma.com/api/mcp/asset/53477de7-fa9d-407b-96e3-323dfe820996' },
};

// ── 미션별 mock 파일명 ────────────────────────────────────────
const MOCK_FILENAMES: Record<string, Record<string, string>> = {
  pdf:     { B_1: 'portfolio_2026.pdf', B_4: 'work_done.pdf',     D_3: 'bill_2026.pdf',  D_4: 'volunteer.pdf'  },
  img:     { B_1: 'screenshot.png',    B_4: 'project_done.png',   D_3: 'receipt.jpg',    D_4: 'certificate.jpg' },
  receipt: { D_3: 'energy_bill.jpg',   D_4: 'donation_receipt.jpg' },
  url:     {},
};

// ── 미션 설정 ─────────────────────────────────────────────────
type FileTypeItem = { id: string; label: string };
type MissionConfig = {
  title: string; desc: string; tagLabel: string;
  fileTypes: FileTypeItem[]; uploadHint: string;
};
const MISSION_CONFIGS: Record<string, MissionConfig> = {
  B_1: {
    title: '포트폴리오', desc: '최근 작업물 또는 포트폴리오를 업로드하세요.',
    tagLabel: '파일 업로드',
    fileTypes: [{ id: 'pdf', label: '📄 PDF' }, { id: 'img', label: '🖼️ JPG/PNG' }, { id: 'url', label: '🔗 URL' }],
    uploadHint: '최대 10MB | PDF, JPG, PNG, URL 지원',
  },
  B_4: {
    title: '업무 완료 인증', desc: '프로젝트 완료 스크린샷 또는 외부 링크를 첨부하세요.',
    tagLabel: '파일 업로드',
    fileTypes: [{ id: 'img', label: '🖼️ JPG/PNG' }, { id: 'url', label: '🔗 URL' }],
    uploadHint: '최대 10MB | JPG, PNG, URL 지원',
  },
  D_3: {
    title: '에너지 절약 미션', desc: '전기세, 가스비 고지서 사진을 업로드하세요.',
    tagLabel: 'OCR 분석',
    fileTypes: [{ id: 'img', label: '🖼️ JPG/PNG' }, { id: 'receipt', label: '🧾 영수증' }],
    uploadHint: '최대 10MB | JPG, PNG, 영수증 지원',
  },
  D_4: {
    title: '봉사·기부 활동', desc: '봉사 확인서 또는 기부 영수증을 업로드하세요.',
    tagLabel: '파일 업로드',
    fileTypes: [{ id: 'pdf', label: '📄 PDF' }, { id: 'img', label: '🖼️ JPG/PNG' }, { id: 'receipt', label: '🧾 영수증' }],
    uploadHint: '최대 10MB | PDF, JPG, PNG, 영수증 지원',
  },
};

// ── AI 분석 단계 ─────────────────────────────────────────────
const AI_STEPS = [
  { id: 1, label: '📂 파일 검증 중'      },
  { id: 2, label: '🤖 AI 진위 분석 중'   },
  { id: 3, label: '📊 행동 점수 산출 중' },
  { id: 4, label: '🔐 keccak256 해싱'    },
  { id: 5, label: '⛓️ 블록체인 등록 중'  },
];

type Props = NativeStackScreenProps<MissionStackParamList, 'MissionUpload'>;

export default function MissionUploadScreen({ route }: Props): React.JSX.Element {
  const { missionId }  = route.params;
  const navigation     = useNavigation();
  const { completeMission, pointBalance } = useMissionStore();
  const { userId }     = useAuthStore();
  const config         = MISSION_CONFIGS[missionId] ?? MISSION_CONFIGS['B_1'];

  // ── 상태 ─────────────────────────────────────────────────
  const [selectedType, setSelectedType]       = useState<string>(config.fileTypes[0]?.id ?? 'pdf');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [urlInput, setUrlInput]               = useState<string>('');
  const [isAnalyzing, setIsAnalyzing]         = useState(false);
  const [completedSteps, setCompletedSteps]   = useState<number>(0);
  const [txHash, setTxHash]                   = useState<string>('');
  const [isCompleted, setIsCompleted]         = useState(false);

  // ── 단계별 완료 페이드인 애니메이션 ──────────────────────
  const stepAnims = useRef(AI_STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (completedSteps > 0) {
      Animated.timing(stepAnims[completedSteps - 1], {
        toValue: 1, duration: 350, useNativeDriver: false,
      }).start();
    }
  }, [completedSteps, stepAnims]);

  // ── 드롭존 탭: mock 파일명 즉시 세팅 ─────────────────────
  const handlePickFile = useCallback((): void => {
    if (isAnalyzing || isCompleted) return;
    const name = MOCK_FILENAMES[selectedType]?.[missionId]
      ?? MOCK_FILENAMES[selectedType]?.['B_1']
      ?? 'upload_file.pdf';
    setUploadedFileName(name);
  }, [isAnalyzing, isCompleted, selectedType, missionId]);

  // ── AI 분석 순차 실행 ─────────────────────────────────────
  const runAnalysis = useCallback((): void => {
    setIsAnalyzing(true);
    setCompletedSteps(0);
    AI_STEPS.forEach((_, idx) => {
      setTimeout(() => {
        setCompletedSteps(idx + 1);
        if (idx === AI_STEPS.length - 1) {
          const mockTx = `0x${Math.random().toString(16).slice(2, 18)}`;
          setTxHash(mockTx);
          setIsCompleted(true);
          setIsAnalyzing(false);
          completeMission(
            userId ?? MOCK_USER_ID,
            missionId as Parameters<typeof completeMission>[1],
            JSON.stringify({ txHash: mockTx, completedAt: new Date().toISOString() }),
          ).catch(() => {});
        }
      }, (idx + 1) * 700);
    });
  }, [completeMission, missionId, userId]);

  // ── 업로드 버튼: 파일 유무 상관없이 즉시 분석 시작 ───────
  const handleUpload = useCallback((): void => {
    if (isAnalyzing || isCompleted) return;
    // 파일/URL 없으면 mock 값 자동 채우기
    if (selectedType === 'url' && urlInput.trim() === '') {
      setUrlInput('https://github.com/example/portfolio');
    } else if (uploadedFileName.trim() === '') {
      const name = MOCK_FILENAMES[selectedType]?.[missionId]
        ?? MOCK_FILENAMES[selectedType]?.['B_1']
        ?? 'upload_file.pdf';
      setUploadedFileName(name);
    }
    runAnalysis();
  }, [isAnalyzing, isCompleted, selectedType, urlInput, uploadedFileName, missionId, runAnalysis]);

  const handleDone = useCallback((): void => { navigation.goBack(); }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f2ed' }}>

      {/* ── 헤더 ──────────────────────────────────────────── */}
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
        contentContainerStyle={{ paddingBottom: S(40) }}>

        {/* ── 미션 카드 ─────────────────────────────────── */}
        <View style={{
          marginHorizontal: S(18), marginTop: S(20), backgroundColor: 'white',
          borderRadius: S(15), paddingHorizontal: S(16), paddingVertical: S(20),
          shadowColor: '#000', shadowOffset: { width: 0.5, height: 0.5 }, shadowOpacity: 0.1, shadowRadius: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={IMG.portfolio} style={{ width: S(40), height: S(40), marginRight: S(12) }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
                <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#090909', fontSize: S(16) }}>
                  {config.title}
                </Text>
                <View style={{ backgroundColor: 'rgba(186,50,0,0.2)', borderRadius: S(5), paddingHorizontal: S(4), paddingVertical: S(2) }}>
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#ba3200', fontSize: S(11) }}>📂 파일 첨부</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), marginTop: S(4) }} numberOfLines={2}>
                {config.desc}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 태그 ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: S(7), marginHorizontal: S(28), marginTop: S(14) }}>
          {[config.tagLabel, 'AI 분석', '블록체인 기록'].map((tag) => (
            <View key={tag} style={{ backgroundColor: 'rgba(215,230,241,0.7)', borderRadius: S(10), paddingHorizontal: S(6), paddingVertical: S(3) }}>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#5f9ecb', fontSize: S(11) }}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* ── 파일 업로드 섹션 ─────────────────────────── */}
        <View style={{
          marginHorizontal: S(18), marginTop: S(14), backgroundColor: 'white',
          borderRadius: S(15), paddingTop: S(16), paddingBottom: S(24), paddingHorizontal: S(9),
        }}>
          <View style={{ marginLeft: S(12), marginBottom: S(12) }}>
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#1b1b1b', fontSize: S(15) }}>🗂️ 오늘의 작업물 업로드</Text>
            <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#8a8a8a', fontSize: S(11), marginTop: S(4), marginLeft: S(18) }}>
              {config.uploadHint}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: S(8), marginBottom: S(16) }} />

          {/* 파일 유형 탭 */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S(10), marginBottom: S(16) }}>
            {config.fileTypes.map((ft) => (
              <TouchableOpacity key={ft.id}
                onPress={() => { setSelectedType(ft.id); setUploadedFileName(''); setUrlInput(''); }}
                style={{
                  height: S(30), paddingHorizontal: S(12), borderRadius: S(10),
                  backgroundColor: selectedType === ft.id ? 'rgba(215,230,241,0.9)' : 'rgba(242,242,242,0.7)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#5f9ecb', fontSize: S(12) }}>{ft.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* URL 입력 or 드롭존 */}
          {selectedType === 'url' ? (
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://..."
              placeholderTextColor="#aaa"
              style={{
                height: S(44), borderRadius: S(10), borderWidth: 1,
                borderColor: 'rgba(0,103,173,0.2)', paddingHorizontal: S(12),
                fontFamily: 'Paperlogy-Regular', fontSize: S(13), color: '#383835',
                backgroundColor: 'rgba(215,230,241,0.15)', marginHorizontal: S(12),
              }}
              autoCapitalize="none" keyboardType="url"
            />
          ) : (
            <TouchableOpacity
              onPress={handlePickFile}
              disabled={isAnalyzing || isCompleted}
              style={{
                marginHorizontal: S(12), height: S(108), borderRadius: S(10),
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isCompleted ? 'rgba(0,107,88,0.06)' : 'rgba(107,107,107,0.1)',
                borderWidth: uploadedFileName ? 1.5 : 0,
                borderColor: uploadedFileName ? '#006b58' : 'transparent',
              }}>
              {isCompleted ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: S(30) }}>✅</Text>
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#006b58', fontSize: S(13), marginTop: S(6) }}>업로드 완료</Text>
                </View>
              ) : uploadedFileName ? (
                <View style={{ alignItems: 'center', paddingHorizontal: S(16) }}>
                  <Text style={{ fontSize: S(28), marginBottom: S(6) }}>📎</Text>
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#006b58', fontSize: S(12), textAlign: 'center' }} numberOfLines={2}>
                    {uploadedFileName}
                  </Text>
                  <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#8a8a8a', fontSize: S(10), marginTop: S(4) }}>탭하여 다시 선택</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={{
                    width: S(43), height: S(43), borderRadius: S(22),
                    backgroundColor: 'rgba(215,230,241,0.7)', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: 'rgba(95,158,203,0.8)', fontSize: S(28), fontWeight: 'bold', lineHeight: S(36) }}>+</Text>
                  </View>
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(11), marginTop: S(8) }}>
                    파일을 선택하거나 여기를 탭하세요
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* 업로드 버튼 — 항상 활성, 누르면 즉시 분석 시작 */}
          {!isCompleted && (
            <TouchableOpacity
              onPress={handleUpload}
              style={{
                marginHorizontal: S(12), marginTop: S(14), height: S(44),
                borderRadius: S(12),
                backgroundColor: isAnalyzing ? 'rgba(0,107,88,0.45)' : '#006b58',
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: S(8),
              }}>
              {isAnalyzing && <ActivityIndicator size="small" color="white" />}
              <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: 'white', fontSize: S(15) }}>
                {isAnalyzing ? '분석 중...' : '업로드'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── AI 분석 섹션 ─────────────────────────────── */}
        <View style={{
          marginHorizontal: S(18), marginTop: S(14), backgroundColor: 'white',
          borderRadius: S(15), paddingTop: S(16), paddingBottom: S(24), paddingHorizontal: S(9),
        }}>
          <View style={{ marginLeft: S(12), marginBottom: S(12) }}>
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#1b1b1b', fontSize: S(15) }}>🖥️ AI 분석</Text>
            <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#8a8a8a', fontSize: S(11), marginTop: S(4), marginLeft: S(18) }}>
              AI가 업로드한 파일의 진위를 분석합니다.
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: S(8), marginBottom: S(16) }} />

          {/* 단계 목록 */}
          <View style={{ gap: S(10), paddingHorizontal: S(12) }}>
            {AI_STEPS.map((step) => {
              const isDone   = completedSteps >= step.id;
              const isActive = isAnalyzing && step.id === completedSteps + 1;

              const bgColor = isDone
                ? stepAnims[step.id - 1].interpolate({ inputRange: [0, 1], outputRange: ['rgba(133,133,133,0.2)', '#e0f2ee'] })
                : isActive ? 'rgba(0,107,88,0.07)' : 'rgba(133,133,133,0.2)';

              return (
                <Animated.View key={step.id} style={{
                  height: S(42), borderRadius: S(10),
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: S(14), backgroundColor: bgColor,
                }}>
                  {isDone ? (
                    <View style={{
                      width: S(20), height: S(20), borderRadius: S(10),
                      backgroundColor: '#006b58', alignItems: 'center', justifyContent: 'center', marginRight: S(10),
                    }}>
                      <Text style={{ color: 'white', fontSize: S(12), fontWeight: 'bold' }}>✓</Text>
                    </View>
                  ) : isActive ? (
                    <ActivityIndicator size="small" color="#006b58"
                      style={{ width: S(20), height: S(20), marginRight: S(10) }} />
                  ) : (
                    <View style={{
                      width: S(20), height: S(20), borderRadius: S(10),
                      backgroundColor: 'rgba(133,133,133,0.35)', marginRight: S(10),
                    }} />
                  )}
                  <Text style={{
                    fontFamily: 'Paperlogy-Medium', fontSize: S(13),
                    color: isDone ? '#006b58' : isActive ? '#004d3f' : '#383835',
                  }}>
                    {step.label}
                  </Text>
                </Animated.View>
              );
            })}
          </View>

          {/* 완료 후 tx 해시 */}
          {txHash ? (
            <View style={{
              marginHorizontal: S(12), marginTop: S(16),
              backgroundColor: 'rgba(0,107,88,0.06)', borderRadius: S(10),
              paddingHorizontal: S(12), paddingVertical: S(8),
            }}>
              <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#006b58', fontSize: S(11) }}>✅ 블록체인 등록 완료</Text>
              <Text style={{ fontFamily: 'Paperlogy-Regular', color: '#8a8a8a', fontSize: S(10), marginTop: S(4) }} numberOfLines={1}>
                {txHash}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── 완료 버튼 ─────────────────────────────────── */}
        {isCompleted && (
          <TouchableOpacity onPress={handleDone} style={{
            marginHorizontal: S(18), marginTop: S(20),
            backgroundColor: '#006b58', borderRadius: S(15),
            height: S(50), alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: 'white', fontSize: S(16) }}>완료</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

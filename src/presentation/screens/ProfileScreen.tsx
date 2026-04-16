// Figma 매칭: [내 정보 — 마이페이지]
/**
 * ProfileScreen.tsx — 타입 완전 수정 버전 (2026-04-16)
 * coins → pointBalance
 * streak → streak?.currentStreak (UserStreak | null 객체)
 * selectCurrentTier → GodScoreTierInfo 객체 → .label 접근
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGodScoreStore,
  selectCurrentScore,
  selectCurrentTier,
} from '../../application/stores/godScoreStore';
import { useMissionStore } from '../../application/stores/missionStore';
import { MOCK_USER_NICKNAME } from '../../constants/mockData';

const IMG = {
  // HomeScreen과 동일한 아바타 아이콘 URL 사용
  border: { uri: 'https://www.figma.com/api/mcp/asset/096d05cd-4f55-481e-926b-6feb57561d60' },
  coin: require('../../../assets/images/coin.png'),
};

const MYDATA_ITEMS = [
  { id: 'bank', icon: '🏦', label: '하나은행 계좌', connected: true },
  { id: 'card', icon: '💳', label: '하나카드', connected: true },
  { id: 'health', icon: '❤️', label: 'Apple HealthKit', connected: true },
  { id: 'telecom', icon: '📱', label: 'KT 통신 데이터', connected: false },
];

const MENU_SECTIONS = [
  {
    title: '계정 관리',
    items: [
      { icon: '🔔', label: '알림 설정', hasArrow: true },
      { icon: '🔒', label: '보안 설정', hasArrow: true },
      { icon: '📄', label: '개인정보 처리방침', hasArrow: true },
    ],
  },
  {
    title: '서비스',
    items: [
      { icon: '❓', label: '자주 묻는 질문', hasArrow: true },
      { icon: '💬', label: '1:1 문의', hasArrow: true },
      { icon: '⭐', label: '앱 평가하기', hasArrow: true },
    ],
  },
  {
    title: '기타',
    items: [
      { icon: '📋', label: '버전 정보', hasArrow: false, value: 'v1.0.0' },
      { icon: '🚪', label: '로그아웃', hasArrow: false, destructive: true },
    ],
  },
];

export default function ProfileScreen() {
  const score = useGodScoreStore(selectCurrentScore) ?? 437;
  // selectCurrentTier → GodScoreTierInfo 객체 → .label 로 문자열 접근
  const tierInfo = useGodScoreStore(selectCurrentTier);
  const tierLabelStr = tierInfo?.label ?? '⭐ 성실';
  const displayTier = tierLabelStr
    .replace('🌱', '').replace('⭐', '').replace('🔥', '').replace('👑', '').trim()
    || tierLabelStr;

  // pointBalance: number, streak: UserStreak | null
  const { pointBalance, streak } = useMissionStore();
  const currentStreak = streak?.currentStreak ?? 0;

  const [notifEnabled, setNotifEnabled] = useState(true);

  const tierColor =
    displayTier === '레전드' ? '#c6a244' :
      displayTier === '갓생' ? '#ba3200' :
        displayTier === '성실' ? '#006b58' : '#888';

  const handleMenuPress = (label: string, destructive?: boolean) => {
    if (destructive) {
      Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: () => Alert.alert('로그아웃 완료') },
      ]);
    } else {
      Alert.alert(label, `${label} 화면은 준비 중입니다.`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── 헤더 (다른 화면과 동일한 inline style) ── */}
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

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 프로필 카드 */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarEmoji}>🐱</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.nickname}>{MOCK_USER_NICKNAME ?? '민영'}님</Text>
            <View style={[styles.tierBadge, { backgroundColor: `${tierColor}20` }]}>
              <Text style={[styles.tierBadgeText, { color: tierColor }]}>{tierLabelStr}</Text>
            </View>
            <Text style={styles.emailText}>jodaeheum800@gmail.com</Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>편집</Text>
          </TouchableOpacity>
        </View>

        {/* 통계 카드 */}
        <View style={styles.statsCard}>
          {[
            { label: '갓생점수', value: (score ?? 437).toLocaleString(), unit: '점', color: '#006b58' },
            { label: '연속 달성', value: String(currentStreak), unit: '일', color: '#ba3200' },
            { label: '보유 포인트', value: pointBalance.toLocaleString(), unit: 'pt', color: '#c6a244' },
          ].map((stat, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.statDivider} />}
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}<Text style={styles.statUnit}>{stat.unit}</Text>
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* 마이데이터 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📊 마이데이터 연동 현황</Text>
          {MYDATA_ITEMS.map(item => (
            <View key={item.id} style={styles.mydataItem}>
              <Text style={styles.mydataIcon}>{item.icon}</Text>
              <Text style={styles.mydataLabel}>{item.label}</Text>
              <View style={[styles.mydataStatus, item.connected ? styles.statusOn : styles.statusOff]}>
                <Text style={[styles.mydataStatusText, item.connected ? styles.statusTextOn : styles.statusTextOff]}>
                  {item.connected ? '연동 완료' : '미연동'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 알림 토글 */}
        <View style={styles.sectionCard}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleIcon}>🔔</Text>
            <Text style={styles.toggleLabel}>미션 알림 받기</Text>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: '#ddd', true: '#a3c9a5' }}
              thumbColor={notifEnabled ? '#006b58' : '#fff'}
            />
          </View>
        </View>

        {/* 메뉴 섹션 */}
        {MENU_SECTIONS.map(section => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.label, (item as any).destructive)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuLabel, (item as any).destructive && styles.menuLabelRed]}>
                  {item.label}
                </Text>
                {item.hasArrow
                  ? <Text style={styles.menuArrow}>›</Text>
                  : <Text style={styles.menuValue}>{(item as any).value ?? ''}</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f2ed' },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(252,249,244,0.7)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  avatarBorder: { position: 'absolute', width: 36, height: 36, borderRadius: 18 },
  avatarEmoji: { fontSize: 20, zIndex: 1 },
  appName: { fontFamily: 'Hana2-Heavy', fontSize: 18, color: '#006b58' },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  coinImg: { width: 16, height: 16, borderRadius: 8 },
  coinText: { fontFamily: 'Hana2-Bold', fontSize: 13, color: '#383835' },
  profileCard: {
    margin: 20, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,217,119,0.3)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#f5d56e',
  },
  profileAvatarEmoji: { fontSize: 32 },
  profileInfo: { flex: 1, gap: 5 },
  nickname: { fontFamily: 'Hana2-Heavy', fontSize: 18, color: '#383835' },
  tierBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  tierBadgeText: { fontFamily: 'Hana2-Bold', fontSize: 12 },
  emailText: { fontFamily: 'Hana2-Regular', fontSize: 11, color: '#aaa' },
  editBtn: { backgroundColor: 'rgba(0,107,88,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontFamily: 'Hana2-Bold', fontSize: 12, color: '#006b58' },
  statsCard: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 36, backgroundColor: '#f0ede8' },
  statValue: { fontFamily: 'Hana2-Heavy', fontSize: 20 },
  statUnit: { fontFamily: 'Hana2-Medium', fontSize: 12 },
  statLabel: { fontFamily: 'Hana2-Regular', fontSize: 11, color: '#888' },
  sectionCard: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontFamily: 'Hana2-Bold', fontSize: 13, color: '#383835', marginBottom: 8 },
  mydataItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f5f2ed' },
  mydataIcon: { fontSize: 18, width: 24 },
  mydataLabel: { flex: 1, fontFamily: 'Hana2-Medium', fontSize: 13, color: '#383835' },
  mydataStatus: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  statusOn: { backgroundColor: 'rgba(0,107,88,0.12)' },
  statusOff: { backgroundColor: '#f0ede8' },
  mydataStatusText: { fontFamily: 'Hana2-Bold', fontSize: 11 },
  statusTextOn: { color: '#006b58' },
  statusTextOff: { color: '#aaa' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleIcon: { fontSize: 18 },
  toggleLabel: { flex: 1, fontFamily: 'Hana2-Medium', fontSize: 14, color: '#383835' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f5f2ed' },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontFamily: 'Hana2-Medium', fontSize: 14, color: '#383835' },
  menuLabelRed: { color: '#ba3200' },
  menuArrow: { fontSize: 20, color: '#ccc' },
  menuValue: { fontFamily: 'Hana2-Regular', fontSize: 12, color: '#aaa' },
});

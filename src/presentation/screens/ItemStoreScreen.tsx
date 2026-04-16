// Figma 매칭: [작업실 꾸미기 스토어 — 16:419]
/**
 * ItemStoreScreen.tsx — Figma 디자인 100% 반영 버전
 * 헤더: HomeScreen/MissionCenterScreen과 동일한 inline style 통일
 * 코인: missionStore.pointBalance 연동 (구매 시 로컬 deducted로 차감)
 *
 * 구성:
 *  1. 헤더 (아바타 + 코인)
 *  2. 스토어 배너: 장바구니 아이콘 + "아이템 스토어" + 서브타이틀
 *  3. 작업실 프리뷰: "민영이의 작업실" + 3D 이미지
 *  4. 카테고리 탭: 🪑가구 / 🪴식물 / 🖼️장식 / 💡조명
 *  5. Items 타이틀 구분선
 *  6. 2열 아이템 그리드 (우드 책상, 프로게이밍 의자, 책꽂이, 와이드 모니터, 아이보리 커튼, 미니 협탁)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMissionStore } from '../../application/stores/missionStore';

// ── 화면 크기 기반 스케일링 ────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const S = (n: number): number => Math.round((Math.min(SCREEN_W, 480) / 390) * n);

// ── Figma 이미지 에셋 ─────────────────────────────────────────────
const IMG = {
  // 헤더
  border:    { uri: 'https://www.figma.com/api/mcp/asset/9135e5c9-50a7-4a2e-80e6-d9de545f613e' },
  coin:      require('../../../assets/images/coin.png'),
  // 작업실 배경
  roomImage: { uri: 'https://www.figma.com/api/mcp/asset/2d2fb92e-138d-49a9-ae18-ccf3d9fac3fa' },
  // 아이템 이미지 (가구 카테고리)
  item1: { uri: 'https://www.figma.com/api/mcp/asset/e69aaaa4-c7ac-4924-84a4-96747ee668c0' }, // 우드 책상
  item2: { uri: 'https://www.figma.com/api/mcp/asset/54932ef8-7aa4-44b5-92c8-eb7d17b41145' }, // 프로게이밍 의자
  item3: { uri: 'https://www.figma.com/api/mcp/asset/52edbc04-7d89-4f59-b228-936e374c2d99' }, // 책꽂이
  item4: { uri: 'https://www.figma.com/api/mcp/asset/4a3c1bb8-8ddd-4811-8b98-c344e1b066eb' }, // 와이드 모니터
  item5: { uri: 'https://www.figma.com/api/mcp/asset/d0c9841b-6e79-40c8-9d15-a6fe879622d3' }, // 아이보리 커튼
  item6: { uri: 'https://www.figma.com/api/mcp/asset/fd97b869-9803-48c2-85af-ff682f7cf1ab' }, // 미니 협탁
};

// ── 카테고리 설정 ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'furniture', label: '🪑 가구'  },
  { id: 'plant',     label: '🪴 식물'  },
  { id: 'deco',      label: '🖼️ 장식' },
  { id: 'light',     label: '💡조명'   },
];

// ── 아이템 데이터 (가구 카테고리) ────────────────────────────────
type StoreItem = {
  id: string;
  name: string;
  price: number;
  image: { uri: string };
  category: string;
};

const ITEMS: StoreItem[] = [
  { id: 'desk',      name: '우드 책상',      price: 200, image: IMG.item1, category: 'furniture' },
  { id: 'chair',     name: '프로게이밍 의자', price: 50,  image: IMG.item2, category: 'furniture' },
  { id: 'shelf',     name: '책꽂이',         price: 70,  image: IMG.item3, category: 'furniture' },
  { id: 'monitor',   name: '와이드 모니터',  price: 170, image: IMG.item4, category: 'furniture' },
  { id: 'curtain',   name: '아이보리 커튼',  price: 100, image: IMG.item5, category: 'furniture' },
  { id: 'sidetable', name: '미니 협탁',      price: 60,  image: IMG.item6, category: 'furniture' },
];

const CAPPED_W    = Math.min(SCREEN_W, 480);
const ITEM_CARD_W = (CAPPED_W - S(13) * 2 - S(12)) / 2; // 좌우 여백 S(13), 간격 S(12)

export default function ItemStoreScreen(): React.JSX.Element {
  // ── missionStore에서 코인 잔고 읽기 ──────────────────────────
  const { pointBalance } = useMissionStore();
  // 구매 시 차감분 (로컬 상태) — pointBalance - deducted = 실제 사용 가능 코인
  const [deducted, setDeducted]           = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState('furniture');
  const [purchasedItems, setPurchasedItems]     = useState<Set<string>>(new Set());

  // 표시 코인 = store 누적 포인트 - 이 화면에서 사용한 금액
  const displayCoins = pointBalance - deducted;

  // 표시할 아이템 (카테고리 필터)
  const visibleItems = ITEMS.filter((item) => item.category === selectedCategory);

  // 구매 핸들러
  const handleBuy = useCallback((item: StoreItem): void => {
    if (purchasedItems.has(item.id)) {
      Alert.alert('알림', '이미 보유한 아이템입니다.');
      return;
    }
    if (displayCoins < item.price) {
      Alert.alert('코인 부족', `코인이 부족합니다. (보유: ${displayCoins}코인, 필요: ${item.price}코인)`);
      return;
    }
    Alert.alert(
      '구매 확인',
      `${item.name}을(를) ${item.price}코인에 구매하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매',
          onPress: () => {
            setDeducted((prev) => prev + item.price);
            setPurchasedItems((prev) => new Set([...prev, item.id]));
            Alert.alert('구매 완료', `${item.name} 구매 완료! 작업실에 배치되었습니다. 🎉`);
          },
        },
      ]
    );
  }, [purchasedItems, displayCoins]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f2ed' }}>

      {/* ── 헤더 (HomeScreen과 동일한 inline style — 64px 고정) ── */}
      <View style={{
        height: 64,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24,
        backgroundColor: 'rgba(252,249,244,0.7)',
        shadowColor: '#1c1c19', shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.06, shadowRadius: 48,
      }}>
        {/* 좌측: 아바타(40px) + 앱명(18px) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 12 }}>
          <Image
            source={IMG.border}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
          <Text style={{ fontFamily: 'Hana2-Medium', color: '#006b58', fontSize: 18, letterSpacing: -0.45 }}>
            하나 더
          </Text>
        </View>

        {/* 우측: 코인 (pill 63×19 + 코인 24×25 + 숫자) */}
        <View style={{ width: 63, height: 27 }}>
          <View style={{
            position: 'absolute', top: 4, left: 0, right: 0, height: 19,
            backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 7,
          }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 27 }}>
            <Image source={IMG.coin} style={{ width: 24, height: 25 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: 13, marginLeft: 2 }}>
              {displayCoins}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S(60) }}>

        {/* ── 스토어 배너 ────────────────────────────────────── */}
        <View style={{ marginLeft: S(24), marginTop: S(20), marginBottom: S(16) }}>
          {/* 🛒 이모지 단일 사용 */}
          <Text style={{ fontSize: S(48), marginBottom: S(4) }}>🛒</Text>
          <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#006b58', fontSize: S(32), lineHeight: S(30) }}>
            아이템 스토어
          </Text>
          <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(13), marginTop: S(8) }}>
            내 작업실을 업그레이드 해 봐요!
          </Text>
        </View>

        {/* ── 작업실 프리뷰 ─────────────────────────────────── */}
        <View style={{ marginHorizontal: S(13), marginBottom: S(20) }}>
          {/* 작업실 이름 구분선 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S(12) }}>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#000', fontSize: S(14), marginHorizontal: S(12), textAlign: 'center' }}>
              🏠{'\n'}민영이의 작업실
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
          </View>

          {/* 작업실 이미지 */}
          <View style={{
            aspectRatio: 389 / 392, borderRadius: S(31), overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
          }}>
            <Image source={IMG.roomImage} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        </View>

        {/* ── 카테고리 탭 ──────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S(9), marginHorizontal: S(16), marginBottom: S(20) }}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={{
                  height: S(31), paddingHorizontal: S(7), borderRadius: S(10),
                  alignItems: 'center', justifyContent: 'center', width: S(82),
                  backgroundColor: isActive ? 'rgba(0,107,88,0.2)' : 'rgba(133,133,133,0.3)',
                  shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
                }}>
                <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: S(16), textAlign: 'center' }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Items 구분선 타이틀 ───────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: S(11), marginBottom: S(16) }}>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
          <Text style={{ fontFamily: 'Paperlogy-Bold', color: '#575757', fontSize: S(15), marginHorizontal: S(16) }}>
            Items
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.12)' }} />
        </View>

        {/* ── 아이템 그리드 (2열) ──────────────────────────── */}
        {visibleItems.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(12), marginHorizontal: S(13), maxWidth: CAPPED_W, alignSelf: 'center' }}>
            {visibleItems.map((item) => {
              const owned = purchasedItems.has(item.id);
              return (
                <View key={item.id} style={{ width: ITEM_CARD_W, alignItems: 'center' }}>
                  {/* 아이템 이름 */}
                  <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#383835', fontSize: S(13), textAlign: 'center', marginBottom: S(8) }}>
                    {item.name}
                  </Text>
                  {/* 아이템 이미지 */}
                  <View style={{
                    width: S(101), height: S(101), borderRadius: S(20), overflow: 'hidden', marginBottom: S(8),
                    backgroundColor: '#fff',
                    shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Image source={item.image} style={{ width: '90%', height: '90%' }} resizeMode="contain" />
                  </View>
                  {/* 가격 (코인 아이콘 + 금액) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(4), marginBottom: S(8) }}>
                    <Image source={IMG.coin} style={{ width: S(18), height: S(18) }} resizeMode="contain" />
                    <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#383835', fontSize: S(13) }}>
                      {item.price}
                    </Text>
                  </View>
                  {/* 구매 버튼 */}
                  <TouchableOpacity
                    onPress={() => handleBuy(item)}
                    disabled={owned}
                    style={{
                      borderRadius: S(10), paddingHorizontal: S(16), height: S(25),
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: owned ? 'rgba(0,107,88,0.06)' : 'rgba(0,107,88,0.12)',
                    }}>
                    <Text style={{ fontFamily: 'Paperlogy-SemiBold', color: '#006b58', fontSize: S(15) }}>
                      {owned ? '보유' : 'Buy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: S(40) }}>
            <Text style={{ fontFamily: 'Paperlogy-Medium', color: '#8a8a8a', fontSize: S(14) }}>준비 중입니다 🛠️</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

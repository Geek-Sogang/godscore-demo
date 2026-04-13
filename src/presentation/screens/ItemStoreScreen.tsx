// Figma 매칭: [작업실 꾸미기 스토어 — ItemStoreScreen]
/**
 * ItemStoreScreen.tsx
 * Step 4: 코인으로 작업실 아이템 구매
 *
 * 구성:
 *  - 상단: 현재 작업실 프리뷰 (배치된 아이템 포함)
 *  - 탭: 가구 / 식물 / 장식 / 조명
 *  - 하단: 아이템 가로 스크롤 카드 (이름 + 가격 + 구매 버튼)
 *  - 구매 완료 시: 작업실 프리뷰 즉시 업데이트
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMissionStore } from '../../application/stores/missionStore';

// ── 아이템 데이터 ──────────────────────────────────────────────────
interface StoreItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: 'furniture' | 'plant' | 'deco' | 'light';
  description: string;
  rarity: 'common' | 'rare' | 'epic';
}

const STORE_ITEMS: StoreItem[] = [
  // 가구
  { id: 'desk_wood',   name: '우드 원목 책상',   emoji: '🪵', price: 200, category: 'furniture', description: '따뜻한 원목 감성의 넓은 책상',     rarity: 'common' },
  { id: 'chair_pro',   name: '프로 게이밍 체어', emoji: '🪑', price: 350, category: 'furniture', description: '장시간 작업에 최적화된 고급 의자',  rarity: 'rare'   },
  { id: 'shelf_tall',  name: '북 쉘프',           emoji: '📚', price: 180, category: 'furniture', description: '갓생러의 필수 책꽂이',               rarity: 'common' },
  { id: 'monitor_4k',  name: '4K 울트라와이드',   emoji: '🖥️', price: 600, category: 'furniture', description: '작업 효율 200% 향상 모니터',        rarity: 'epic'   },
  // 식물
  { id: 'cactus',      name: '미니 선인장',       emoji: '🌵', price: 80,  category: 'plant',     description: '물 안 줘도 되는 갓생 식물',        rarity: 'common' },
  { id: 'monstera',    name: '몬스테라',           emoji: '🪴', price: 150, category: 'plant',     description: '인스타 감성의 대형 관엽 식물',     rarity: 'rare'   },
  { id: 'flower_pot',  name: '소국 화분',          emoji: '🌸', price: 120, category: 'plant',     description: '화사한 핑크빛 소국 화분',           rarity: 'common' },
  { id: 'bonsai',      name: '분재 나무',          emoji: '🎋', price: 400, category: 'plant',     description: '고급스러운 미니 분재',              rarity: 'epic'   },
  // 장식
  { id: 'photo_frame', name: '골드 액자',          emoji: '🖼️', price: 100, category: 'deco',      description: '갓생 순간을 담는 골드 프레임',     rarity: 'common' },
  { id: 'trophy',      name: '갓생 트로피',        emoji: '🏆', price: 500, category: 'deco',      description: '갓생 달성 기념 황금 트로피',       rarity: 'epic'   },
  { id: 'clock_wood',  name: '원목 벽시계',        emoji: '🕐', price: 160, category: 'deco',      description: '내추럴한 원목 벽걸이 시계',        rarity: 'common' },
  { id: 'whiteboard',  name: '화이트보드',         emoji: '📋', price: 220, category: 'deco',      description: '아이디어를 쏟아내는 대형 보드',    rarity: 'rare'   },
  // 조명
  { id: 'led_strip',   name: 'LED 무드 조명',      emoji: '💡', price: 130, category: 'light',     description: '집중력을 높이는 따뜻한 LED',       rarity: 'common' },
  { id: 'desk_lamp',   name: '북유럽 스탠드 조명', emoji: '🪔', price: 200, category: 'light',     description: '눈에 편안한 자연광 스탠드',        rarity: 'rare'   },
  { id: 'neon_sign',   name: '네온 사인',           emoji: '✨', price: 450, category: 'light',     description: '분위기 UP! 커스텀 네온 사인',      rarity: 'epic'   },
];

const CATEGORY_TABS = [
  { id: 'furniture', label: '가구',  emoji: '🪑' },
  { id: 'plant',     label: '식물',  emoji: '🪴' },
  { id: 'deco',      label: '장식',  emoji: '🖼️' },
  { id: 'light',     label: '조명',  emoji: '💡' },
] as const;

const RARITY_STYLE: Record<string, { badge: string; border: string }> = {
  common: { badge: 'bg-gray-100 text-gray-500',     border: 'border-gray-100'  },
  rare:   { badge: 'bg-blue-100 text-blue-600',     border: 'border-blue-100'  },
  epic:   { badge: 'bg-purple-100 text-purple-600', border: 'border-purple-100' },
};

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON', rare: 'RARE', epic: 'EPIC',
};

// ── 작업실 프리뷰 ──────────────────────────────────────────────────
function WorkspacePreview({ ownedItems }: { ownedItems: Set<string> }) {
  const placed = STORE_ITEMS.filter(i => ownedItems.has(i.id)).slice(0, 5);
  return (
    <View className="mx-4 mt-4 rounded-3xl overflow-hidden bg-indigo-50 border border-indigo-100 h-44">
      {/* 배경 */}
      <View className="absolute inset-0 bg-gradient-to-b from-indigo-50 to-violet-50" />
      <View className="absolute bottom-0 left-0 right-0 h-16 bg-amber-50/60" />

      {/* 레벨 뱃지 */}
      <View className="absolute top-3 left-3 bg-white/80 rounded-full px-3 py-1 border border-purple-100">
        <Text className="text-xs font-bold text-purple-600">
          🏠 내 작업실 Lv.{Math.min(1 + Math.floor(ownedItems.size / 2), 10)}
        </Text>
      </View>

      {/* 보유 아이템 표시 */}
      <View className="absolute top-10 left-3 flex-row flex-wrap gap-2">
        {placed.map(item => (
          <View key={item.id} className="w-9 h-9 bg-white/70 rounded-xl items-center justify-center border border-white/50">
            <Text className="text-lg">{item.emoji}</Text>
          </View>
        ))}
      </View>

      {/* 캐릭터 */}
      <View className="absolute bottom-4 right-1/3 items-center">
        <View className="w-16 h-20 bg-purple-100/70 rounded-t-full items-center justify-center border border-purple-200/50">
          <Text className="text-3xl">🧑‍💻</Text>
        </View>
      </View>

      {/* 빈 작업실 메시지 */}
      {ownedItems.size === 0 && (
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-sm text-indigo-400 font-medium">아이템을 구매해서 작업실을 꾸며보세요!</Text>
        </View>
      )}
    </View>
  );
}

// ── 아이템 카드 ────────────────────────────────────────────────────
function ItemCard({
  item,
  owned,
  canAfford,
  onBuy,
}: {
  item: StoreItem;
  owned: boolean;
  canAfford: boolean;
  onBuy: (item: StoreItem) => void;
}) {
  const rarity = RARITY_STYLE[item.rarity];
  return (
    <View className={`w-44 bg-white rounded-2xl border mr-3 overflow-hidden ${rarity.border}`}>
      {/* 이모지 배경 */}
      <View className="h-24 bg-gray-50 items-center justify-center">
        <Text style={{ fontSize: 44 }}>{item.emoji}</Text>
      </View>

      {/* 정보 */}
      <View className="p-3">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Text className="text-xs font-black text-gray-800 flex-1" numberOfLines={1}>{item.name}</Text>
          <View className={`rounded-full px-1.5 py-0.5 ${rarity.badge}`}>
            <Text className="text-[9px] font-black">{RARITY_LABEL[item.rarity]}</Text>
          </View>
        </View>
        <Text className="text-xs text-gray-400 mb-2.5" numberOfLines={2}>{item.description}</Text>

        {/* 가격 + 구매 버튼 */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Text className="text-sm">🪙</Text>
            <Text className="text-sm font-black text-amber-600">{item.price}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onBuy(item)}
            disabled={owned || !canAfford}
            className={`px-3 py-1.5 rounded-xl ${
              owned      ? 'bg-green-100' :
              canAfford  ? 'bg-green-500' : 'bg-gray-100'
            }`}
            activeOpacity={0.8}
          >
            <Text className={`text-xs font-bold ${
              owned     ? 'text-green-600' :
              canAfford ? 'text-white'     : 'text-gray-400'
            }`}>
              {owned ? '보유중 ✓' : canAfford ? '구매' : '코인 부족'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function ItemStoreScreen() {
  const [activeTab, setActiveTab]     = useState<'furniture' | 'plant' | 'deco' | 'light'>('furniture');
  const [ownedItems, setOwnedItems]   = useState<Set<string>>(new Set());

  const pointBalance = useMissionStore(s => s.pointBalance);

  const filteredItems = STORE_ITEMS.filter(i => i.category === activeTab);

  const handleBuy = useCallback((item: StoreItem) => {
    if (pointBalance < item.price) {
      Alert.alert('코인 부족', `${item.name} 구매에는 🪙 ${item.price} 코인이 필요합니다.\n현재 잔고: ${pointBalance} 코인`);
      return;
    }
    Alert.alert(
      '구매 확인',
      `${item.emoji} ${item.name}\n🪙 ${item.price} 코인을 사용합니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '구매하기',
          onPress: () => {
            setOwnedItems(prev => new Set([...prev, item.id]));
            Alert.alert('🎉 구매 완료!', `${item.emoji} ${item.name}이(가) 작업실에 추가되었습니다!`);
          },
        },
      ]
    );
  }, [pointBalance]);

  return (
    <SafeAreaView className="flex-1 bg-hana-lightgray" edges={['top']}>
      {/* ── 헤더 ── */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-black text-gray-800">🛒 작업실 스토어</Text>
            <Text className="text-xs text-gray-400 mt-0.5">코인으로 작업실을 꾸며보세요</Text>
          </View>
          <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 gap-1">
            <Text className="text-base">🪙</Text>
            <Text className="text-sm font-black text-amber-700">{pointBalance.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── 작업실 프리뷰 ── */}
        <View className="mt-1">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
            <Text className="text-sm font-bold text-gray-700">🏠 내 작업실 미리보기</Text>
            <Text className="text-xs text-gray-400">보유 아이템 {ownedItems.size}개</Text>
          </View>
          <WorkspacePreview ownedItems={ownedItems} />
        </View>

        {/* ── 카테고리 탭 ── */}
        <View className="flex-row px-4 mt-5 gap-2">
          {CATEGORY_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl items-center border ${
                activeTab === tab.id
                  ? 'bg-gray-800 border-gray-800'
                  : 'bg-white border-gray-100'
              }`}
            >
              <Text className="text-base">{tab.emoji}</Text>
              <Text className={`text-xs font-bold mt-0.5 ${
                activeTab === tab.id ? 'text-white' : 'text-gray-500'
              }`}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 아이템 카드 가로 스크롤 ── */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-sm font-bold text-gray-700">
              {CATEGORY_TABS.find(t => t.id === activeTab)?.emoji}{' '}
              {CATEGORY_TABS.find(t => t.id === activeTab)?.label} 아이템
            </Text>
            <Text className="text-xs text-gray-400">{filteredItems.length}개</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
          >
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                owned={ownedItems.has(item.id)}
                canAfford={pointBalance >= item.price}
                onBuy={handleBuy}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── 보유 아이템 목록 ── */}
        {ownedItems.size > 0 && (
          <View className="mx-4 mt-5 bg-white rounded-3xl border border-gray-100 p-4">
            <Text className="text-sm font-bold text-gray-700 mb-3">✅ 보유 아이템</Text>
            <View className="flex-row flex-wrap gap-2">
              {STORE_ITEMS.filter(i => ownedItems.has(i.id)).map(item => (
                <View key={item.id} className="flex-row items-center gap-1.5 bg-green-50 rounded-full px-3 py-1.5 border border-green-100">
                  <Text className="text-sm">{item.emoji}</Text>
                  <Text className="text-xs font-semibold text-green-700">{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 코인 충전 안내 ── */}
        <View className="mx-4 mt-4 bg-amber-50 rounded-2xl border border-amber-100 p-4 flex-row items-center gap-3">
          <Text className="text-2xl">💡</Text>
          <View className="flex-1">
            <Text className="text-sm font-bold text-amber-800">코인이 부족한가요?</Text>
            <Text className="text-xs text-amber-600 mt-0.5">미션을 완료하면 코인을 획득할 수 있어요 (미션당 🪙 50)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

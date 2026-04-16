/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Figma 추출 토큰 ────────────────────────────
        hana: {
          // 메인 그린 (로고, 선택 탭, 점수 숫자)
          green:    '#006b58',
          // 배경
          bg:       '#f5f2ed',
          cream:    '#f5f2ed',
          // 카드 배경
          card:     '#ffffff',
          // 텍스트
          text:     '#383835',
          textMuted:'rgba(28,28,25,0.5)',
          // 레드 (스트릭, 카운트)
          red:      '#ba3200',
          // 블루 (코인, 포인트)
          blue:     '#3971e0',
          lightBlue:'#d2e0ff',
          // 카테고리 배경
          catA:     'rgba(255,217,119,0.24)',   // 생활 (노랑)
          catABorder:'#f5d56e',
          catB:     '#d7e6f1',                  // 일·소득 (파랑)
          catC:     '#e3def5',                  // 소비 (보라)
          catD:     '#cfe4d0',                  // ESG (초록)
          // 카테고리 텍스트 (진한 버전)
          catAText: '#c6a244',
          catBText: '#2d6a9f',
          catCText: '#6b5bbf',
          catDText: '#3a7d44',
          // 화면 배경색 (SafeAreaView)
          lightgray: '#f5f2ed',
          // 미션 버튼
          missionBtn: '#e8f3f0',
          missionBtnText: '#006b58',
        },
      },
      fontFamily: {
        // ── Hana2.0 패밀리 ──────────────────────────
        hanaLight:    ['Hana2-Light'],
        hana:         ['Hana2-Regular'],
        hanaMedium:   ['Hana2-Medium'],
        hanaBold:     ['Hana2-Bold'],
        hanaHeavy:    ['Hana2-Heavy'],
        hanaCM:       ['Hana2-CM'],
        // ── Paperlogy 패밀리 (Figma 타이틀·부제목) ──
        paperlogy:          ['Paperlogy-Regular'],
        paperlogyMedium:    ['Paperlogy-Medium'],
        paperlogySemiBold:  ['Paperlogy-SemiBold'],
        paperlogyBold:      ['Paperlogy-Bold'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

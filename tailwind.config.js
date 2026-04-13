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
        // 하나 더 브랜드 컬러
        hana: {
          green:    '#00A651',   // 하나은행 그린
          gold:     '#F5A623',   // 갓생 골드
          warm:     '#FF6B35',   // 워밍 오렌지
          navy:     '#1A2B5F',   // 딥 네이비
          cream:    '#FFF9F0',   // 크림 배경
          mint:     '#E8F5E9',   // 민트 배경
          skyblue:  '#E3F2FD',   // 스카이블루 배경
          charcoal: '#2D3748',   // 차콜
          lightgray:'#F7F8FA',   // 라이트 그레이
        },
      },
      fontFamily: {
        pretendard: ['Pretendard', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

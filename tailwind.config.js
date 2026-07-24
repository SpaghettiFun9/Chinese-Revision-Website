/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Mandarin tone palette (used for characters + pinyin)
        tone1: '#d92626', // 1st tone – red
        tone2: '#d99a00', // 2nd tone – yellow/amber (darkened for legibility)
        tone3: '#1a9e4b', // 3rd tone – green
        tone4: '#2563eb', // 4th tone – blue
        tone5: '#94a3b8', // neutral tone – gray
      },
      fontFamily: {
        hanzi: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

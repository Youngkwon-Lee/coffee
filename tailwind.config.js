/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // 현대적인 커피 테마 색상 팔레트
        coffee: {
          50: '#fefdf8',
          100: '#fdf9ee',
          200: '#faf0d5',
          300: '#f6e4bb',
          400: '#eed087',
          500: '#e6bc53',
          600: '#cf9c2e',
          700: '#b8841f',
          800: '#9a6f19',
          900: '#7f5d16',
        },
        cream: {
          50: '#fefefe',
          100: '#fdfdfd',
          200: '#fbfbfb',
          300: '#f7f7f7',
          400: '#f0f0f0',
          500: '#e8e8e8',
          600: '#d1d1d1',
          700: '#b3b3b3',
          800: '#8a8a8a',
          900: '#6d6d6d',
        },
        brown: {
          50: '#f7f5f3',
          100: '#ede7e1',
          200: '#dbc9bd',
          300: '#c5a693',
          400: '#b18a70',
          500: '#9d6f4f',
          600: '#8b5a40',
          700: '#744a37',
          800: '#5f3e32',
          900: '#4f352c',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
        'display': ['Inter', 'Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
        'body': ['Inter', 'Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
        'hover': '0 8px 30px -2px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        'glass': '40px',
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-in-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#080604',
        dark: '#0e0a07',
        surface: '#1a1410',
        elevated: '#231c16',
        zinc: {
          850: '#1c1917',
        },
        border: {
          DEFAULT: '#2a2018',
          light: '#3a3025',
        },
        ink: {
          DEFAULT: '#d4c9a8',
          muted: '#7a6f5a',
          faint: '#4a4035',
        },
        blood: {
          DEFAULT: '#8b1a1a',
          light: '#b02020',
          dark: '#5c1010',
        },
        military: '#4a5240',
        rust: '#7a3a18',
      },
      fontFamily: {
        heading: ['"Special Elite"', 'Georgia', 'serif'],
        body: ['"Share Tech"', 'system-ui', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      backgroundImage: {
        'noise': "url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4t5eXlzc3OLi4ubm5uVlZWPj4+NjY19fX2JiYl/f39ra2uRkZGZmZlpaWmXl5dvb29xcXGTk5NnZ2c8TV1mAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAAFVklEQVR4XpWWB67c2BUFb3g557T/hRo9/WUMZHlgr4Bg8Z4qQgQJlHI4A8SzFVrapvmTF9O7dme6/mqVtX428ohbdSEQqXPfxGGGiOCGhJwBaF74kQMBGAcGANDLBWuCPFWbK+LAHHQIQlMgAz6yX2QiI1H5BkqQJkxYq4O8EkQcyBFPGfxpqRnp1IWJAGCpqBD0CUfFQDzDrNm/HlUgR7HJpMeEy3h6Fz4glEjU3BXd4LaxLZ5gM+TBNQcLYJOjrBq1VhIKKFMWFMUFHNq/rAfq+dSPBLlJIinUDJrEEGBDCFMRDnT4mCJrCzVLDiNX6x+5H1r7nwjfXmIGEn5LS5IKMnSSEPUL+OBilKkZKBDEK12jVDMcL+dlCIUiOTXjA2NKWcUx+j0xMpw0rFAZ5GrCj4HjMGCBkJbV0c+IjHLrMKYaJWKDMX3ASZkzVChw2I+3IqREBlO6kEOK+0TGPHhT6nQp0M1PijVFvV2I+xIIfnOBRlAPAhGi8PgBc8o9h3AjbE5vPwpAQAA\")",
      },
      animation: {
        'flicker': 'flicker 3s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.8' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.9' },
          '97%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

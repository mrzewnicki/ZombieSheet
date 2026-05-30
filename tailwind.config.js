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
        'cracks': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='500'%3E%3Cg stroke='%235a4030' stroke-linecap='round' stroke-linejoin='round' fill='none' opacity='0.55'%3E%3Cpath stroke-width='1.2' d='M100,0 L118,48 L88,95 L122,150 L108,215 L140,275 L118,340 L145,415 L125,500'/%3E%3Cpath stroke-width='.8' d='M118,48 L72,80 L40,98'/%3E%3Cpath stroke-width='.8' d='M88,95 L48,112 L12,130 L0,145'/%3E%3Cpath stroke-width='.7' d='M122,150 L172,134 L235,118 L290,135 L350,118 L412,134 L468,120 L500,128'/%3E%3Cpath stroke-width='.5' d='M108,215 L78,232 L45,225 L18,240 L0,255'/%3E%3Cpath stroke-width='.6' d='M140,275 L190,260 L245,278'/%3E%3Cpath stroke-width='.5' d='M118,340 L85,358 L55,385 L28,372'/%3E%3Cpath stroke-width='1.0' d='M370,0 L352,55 L388,92 L365,152 L395,205 L372,262 L405,318 L382,385 L412,448 L392,500'/%3E%3Cpath stroke-width='.7' d='M352,55 L298,45 L255,60 L215,48 L180,65'/%3E%3Cpath stroke-width='.6' d='M388,92 L435,78 L482,92 L500,85'/%3E%3Cpath stroke-width='.6' d='M365,152 L415,168 L462,155 L500,165'/%3E%3Cpath stroke-width='.5' d='M395,205 L445,222 L492,210 L500,215'/%3E%3Cpath stroke-width='.5' d='M372,262 L325,278 L288,264 L255,280'/%3E%3Cpath stroke-width='.5' d='M405,318 L452,335 L498,322 L500,325'/%3E%3Cpath stroke-width='.4' d='M205,355 L228,372 L215,398 L235,422'/%3E%3Cpath stroke-width='.4' d='M478,275 L500,295 L490,322'/%3E%3Cpath stroke-width='.3' d='M52,342 L75,358 L65,385'/%3E%3Cpath stroke-width='.3' d='M485,415 L500,432 L492,458 L500,485'/%3E%3Cpath stroke-width='.3' d='M250,458 L272,475 L262,498'/%3E%3C/g%3E%3C/svg%3E\")",
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

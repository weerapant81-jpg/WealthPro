import axios from 'axios'

// ปลายทาง API:
//   ไม่ตั้ง VITE_API_URL → '/api' บนโดเมนเดียวกัน แล้วให้ vercel.json rewrite ไป backend production (ค่าเริ่มต้นเดิม)
//   ตั้ง VITE_API_URL   → ยิงตรงไป backend ตัวนั้น (ใช้กับ staging/preview ที่ต้องไม่แตะฐานข้อมูลจริง)
// ⚠️ ถ้าตั้งค่านี้ ต้องเพิ่มโดเมนหน้าเว็บเข้า FRONTEND_URL ของ backend ตัวนั้นด้วย ไม่งั้น CORS จะบล็อก
const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api`
  : '/api'

export const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  // FA client-switching: attach selected client ID
  const clientId = sessionStorage.getItem('selected_client_id')
  if (clientId) cfg.headers['X-Client-Id'] = clientId
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: refresh })
          localStorage.setItem('access_token', data.access)
          err.config.headers.Authorization = `Bearer ${data.access}`
          return api.request(err.config)
        } catch {
          localStorage.clear()
          sessionStorage.removeItem('selected_client_id')
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        sessionStorage.removeItem('selected_client_id')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

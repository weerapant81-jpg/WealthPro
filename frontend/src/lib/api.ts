import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

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
          const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh })
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

import { createContext, useContext, useState, type ReactNode } from 'react'

export interface ClientInfo {
  id: string
  name: string
  email: string
  phone?: string | null
}

interface ClientCtx {
  selectedClient: ClientInfo | null
  setSelectedClient: (c: ClientInfo | null) => void
}

const Ctx = createContext<ClientCtx>({ selectedClient: null, setSelectedClient: () => {} })

// อ่านลูกค้าที่เลือกจาก sessionStorage แบบ synchronous (กัน guard เด้งผิดตอน refresh)
function initClient(): ClientInfo | null {
  try {
    const id = sessionStorage.getItem('selected_client_id')
    const name = sessionStorage.getItem('selected_client_name')
    const email = sessionStorage.getItem('selected_client_email')
    return id && name && email ? { id, name, email } : null
  } catch { return null }
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(initClient)
  return <Ctx.Provider value={{ selectedClient, setSelectedClient }}>{children}</Ctx.Provider>
}

export const useClient = () => useContext(Ctx)

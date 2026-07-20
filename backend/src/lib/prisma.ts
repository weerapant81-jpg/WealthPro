import { PrismaClient } from '@prisma/client'

/** error ชั่วคราวจากการเชื่อมต่อ (เช่น Neon กำลังตื่นจากโหมดพัก) — ควรลองใหม่ */
function isTransient(e: any): boolean {
  const code = e?.code
  const msg = String(e?.message ?? '')
  return (
    code === 'P1001' ||   // Can't reach database server
    code === 'P1002' ||   // server reached but timed out
    code === 'P1017' ||   // server closed the connection
    /Can't reach database server|Connection.*(closed|reset)|ECONNRESET|ETIMEDOUT|terminating connection/i.test(msg)
  )
}

function makeClient() {
  return new PrismaClient().$extends({
    query: {
      // ครอบทุก query — ถ้าเชื่อมต่อฐานข้อมูลไม่ได้ชั่วคราว (Neon หลับ) ให้ลองใหม่ก่อนโยน error
      async $allOperations({ args, query }) {
        let lastErr: any
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await query(args)
          } catch (e) {
            lastErr = e
            if (!isTransient(e) || attempt === 3) throw e
            // รอให้ Neon ตื่น แล้วลองใหม่ (300, 700, 1100 ms)
            await new Promise(r => setTimeout(r, 300 + attempt * 400))
          }
        }
        throw lastErr
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof makeClient> }

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

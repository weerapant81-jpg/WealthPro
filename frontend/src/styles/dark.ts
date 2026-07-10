export const card: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 16,
  padding: '20px 22px',
}

export const inp: React.CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

export const sel: React.CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

export const btn = (color = '#0ea5e9'): React.CSSProperties => ({
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: color, color: '#fff', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
})

export const btnGhost: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'transparent', color: 'var(--text-secondary)',
  fontSize: 13, cursor: 'pointer',
}

export const label: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4,
}

export const h2: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, color: 'var(--text-primary)',
}

export const muted: React.CSSProperties = {
  fontSize: 13, color: 'var(--text-muted)',
}

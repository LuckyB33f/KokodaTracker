import Container from '@mui/material/Container'
import type { ReactNode } from 'react'

// Mobile-first page wrapper (spec designs at 380px).
export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <Container maxWidth="sm" sx={{ py: 3, px: 2 }}>
      {children}
    </Container>
  )
}

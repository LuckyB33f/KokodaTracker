import Paper from '@mui/material/Paper'
import type { ReactNode } from 'react'

export default function FormCard({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 } }}>
      {children}
    </Paper>
  )
}

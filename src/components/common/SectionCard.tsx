import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  children: ReactNode
}

export default function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, mb: 2 }}>
      {title && (
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      {children}
    </Paper>
  )
}

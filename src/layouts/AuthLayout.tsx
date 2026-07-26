import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import TerrainIcon from '@mui/icons-material/Terrain'
import LoadingState from '@/components/common/LoadingState'

export default function AuthLayout() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="xs" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            mb: 3,
          }}
        >
          <TerrainIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h1" component="p">
            Kokoda Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Train together for race day
          </Typography>
        </Box>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </Container>
    </Box>
  )
}

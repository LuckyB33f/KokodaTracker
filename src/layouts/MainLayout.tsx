import { Suspense } from 'react'
import { Link as RouterLink, Outlet } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import PersonIcon from '@mui/icons-material/Person'
import TerrainIcon from '@mui/icons-material/Terrain'
import LoadingState from '@/components/common/LoadingState'

export default function MainLayout() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar position="sticky" color="default">
        <Toolbar>
          <TerrainIcon color="primary" sx={{ mr: 1 }} />
          <Typography
            variant="h3"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            Kokoda Tracker
          </Typography>
          <IconButton
            component={RouterLink}
            to="/profile"
            aria-label="Profile"
            sx={{ width: 44, height: 44 }}
          >
            <PersonIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  )
}

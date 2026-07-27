import { Suspense } from 'react'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EventNoteIcon from '@mui/icons-material/EventNote'
import GroupIcon from '@mui/icons-material/Group'
import HikingIcon from '@mui/icons-material/Hiking'
import PersonIcon from '@mui/icons-material/Person'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import TerrainIcon from '@mui/icons-material/Terrain'
import InstallPrompt from '@/components/common/InstallPrompt'
import LoadingState from '@/components/common/LoadingState'
import OfflineBanner from '@/components/common/OfflineBanner'

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: <DashboardIcon /> },
  { label: 'Plan', to: '/plan', icon: <EventNoteIcon /> },
  { label: 'Log', to: '/sessions', icon: <HikingIcon /> },
  { label: 'Food', to: '/food', icon: <RestaurantIcon /> },
  { label: 'Team', to: '/team', icon: <GroupIcon /> },
]

function currentNavValue(pathname: string): string | false {
  if (pathname === '/') return '/'
  const match = NAV_ITEMS.find(
    (item) => item.to !== '/' && pathname.startsWith(item.to),
  )
  return match ? match.to : false
}

export default function MainLayout() {
  const { pathname } = useLocation()

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
      <OfflineBanner />
      {/* pb clears the fixed bottom nav (56px + safe area). */}
      <Box component="main" sx={{ flexGrow: 1, pb: 9 }}>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </Box>
      <Paper
        elevation={8}
        square
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          pb: 'env(safe-area-inset-bottom)',
          zIndex: (muiTheme) => muiTheme.zIndex.appBar,
        }}
      >
        <BottomNavigation value={currentNavValue(pathname)} showLabels>
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.to}
              component={RouterLink}
              to={item.to}
              value={item.to}
              label={item.label}
              icon={item.icon}
              sx={{ minWidth: 0 }}
            />
          ))}
        </BottomNavigation>
      </Paper>
      <InstallPrompt />
    </Box>
  )
}

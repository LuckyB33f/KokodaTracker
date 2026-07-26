import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ExploreOffIcon from '@mui/icons-material/ExploreOff'
import EmptyState from '@/components/common/EmptyState'
import SEO from '@/components/common/SEO'

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <SEO title="Page not found" noindex />
      <EmptyState
        icon={<ExploreOffIcon color="primary" sx={{ fontSize: 48 }} />}
        title="Off the trail"
        description="This page doesn't exist."
        action={
          <Button component={RouterLink} to="/" variant="contained">
            Back to base
          </Button>
        }
      />
    </Box>
  )
}

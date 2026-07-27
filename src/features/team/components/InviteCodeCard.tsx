import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import SectionCard from '@/components/common/SectionCard'
import { useRegenerateInviteCodeMutation } from '@/services/teamApi'
import type { Team } from '../types/teamTypes'

interface InviteCodeCardProps {
  team: Team
  isCaptain: boolean
}

export default function InviteCodeCard({ team, isCaptain }: InviteCodeCardProps) {
  const [regenerate, { isLoading }] = useRegenerateInviteCodeMutation()
  const [copied, setCopied] = useState(false)

  return (
    <SectionCard title="Invite code">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Teammates join with this code (2–5 people per team).
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography
          variant="h2"
          component="p"
          sx={{ letterSpacing: 6, fontFamily: 'monospace' }}
          aria-label={`Invite code ${team.inviteCode.split('').join(' ')}`}
        >
          {team.inviteCode}
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void navigator.clipboard.writeText(team.inviteCode).then(() => {
              setCopied(true)
            })
          }}
        >
          Copy
        </Button>
        {isCaptain && (
          <Button
            size="small"
            color="inherit"
            startIcon={<RefreshIcon />}
            disabled={isLoading}
            onClick={() => {
              void regenerate({ teamId: team.id, oldCode: team.inviteCode })
            }}
          >
            New code
          </Button>
        )}
      </Box>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Invite code copied"
      />
    </SectionCard>
  )
}

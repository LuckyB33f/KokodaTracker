import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ActionButton from '@/components/common/ActionButton'
import { useAddTemplateMutation } from '@/services/templateApi'
import type {
  TemplateCreatedFrom,
  TemplateKind,
  TemplatePayload,
} from '../types/templateTypes'

interface SaveTemplateDialogProps {
  open: boolean
  onClose: () => void
  kind: TemplateKind
  payload: TemplatePayload | null
  defaultName: string
  createdFrom: TemplateCreatedFrom
  uid: string
  // Captains can save to the team library instead (R12.1/R12.3).
  teamId?: string
  isCaptain?: boolean
}

export default function SaveTemplateDialog({
  open,
  onClose,
  kind,
  payload,
  defaultName,
  createdFrom,
  uid,
  teamId,
  isCaptain = false,
}: SaveTemplateDialogProps) {
  const [addTemplate, { isLoading }] = useAddTemplateMutation()
  const [name, setName] = useState(defaultName)
  const [asTeam, setAsTeam] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setAsTeam(false)
      setError(null)
    }
  }, [open, defaultName])

  const save = async () => {
    if (!payload || !name.trim()) return
    setError(null)
    const result = await addTemplate({
      scope: asTeam && isCaptain && teamId ? 'team' : 'personal',
      ownerId: asTeam && isCaptain && teamId ? teamId : uid,
      kind,
      name,
      payload,
      createdFrom,
    })
    if ('error' in result && result.error) {
      setError(
        (result.error as { message?: string }).message ??
          'Couldn’t save the template.',
      )
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Save as template</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputProps={{ maxLength: 60 }}
          sx={{ mt: 1 }}
        />
        {isCaptain && teamId && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={asTeam}
                onChange={(e) => setAsTeam(e.target.checked)}
              />
            }
            label="Share with the whole team"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <ActionButton
          fullWidth={false}
          loading={isLoading}
          disabled={!name.trim() || !payload}
          onClick={() => void save()}
        >
          Save template
        </ActionButton>
      </DialogActions>
    </Dialog>
  )
}

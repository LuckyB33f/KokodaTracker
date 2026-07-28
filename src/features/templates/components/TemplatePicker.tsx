import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EditNoteIcon from '@mui/icons-material/EditNote'
import GroupIcon from '@mui/icons-material/Group'
import PersonIcon from '@mui/icons-material/Person'
import type { Template, TemplateKind } from '../types/templateTypes'
import type { SessionTemplatePayload } from '../types/templateTypes'

interface TemplatePickerProps {
  kind: TemplateKind
  personal: Template[]
  team: Template[]
  onPick: (template: Template) => void
  onBlank: () => void
  blankLabel?: string
}

function summarise(template: Template): string | undefined {
  if (template.kind === 'session') {
    const p = template.payload as SessionTemplatePayload
    const parts = [`${p.durationMin} min`]
    if (p.distanceKm) parts.push(`${p.distanceKm} km`)
    if (p.elevationGainM) parts.push(`${p.elevationGainM} m ↑`)
    parts.push(`effort ${p.perceivedEffort}/10`)
    return parts.join(' · ')
  }
  const items = 'items' in template.payload ? template.payload.items : []
  return `${items.length} meal${items.length === 1 ? '' : 's'}`
}

// R12.4: templates first, blank entry one tap away.
export default function TemplatePicker({
  kind,
  personal,
  team,
  onPick,
  onBlank,
  blankLabel = 'Start blank',
}: TemplatePickerProps) {
  const sections = [
    { label: 'Team templates', icon: <GroupIcon fontSize="small" />, items: team },
    { label: 'Your templates', icon: <PersonIcon fontSize="small" />, items: personal },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((template) => template.kind === kind),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <Stack spacing={2}>
      {sections.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No templates yet — save one from{' '}
          {kind === 'session' ? 'a logged session' : 'a logged day of meals'}{' '}
          and it’ll appear here.
        </Typography>
      )}
      {sections.map((section) => (
        <div key={section.label}>
          <Typography
            variant="subtitle2"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
          >
            {section.icon}
            {section.label}
          </Typography>
          <List disablePadding>
            {section.items.map((template) => (
              <ListItemButton
                key={`${template.scope}-${template.id}`}
                onClick={() => onPick(template)}
              >
                <ListItemText
                  primary={template.name}
                  secondary={summarise(template)}
                />
              </ListItemButton>
            ))}
          </List>
        </div>
      ))}
      <Button startIcon={<EditNoteIcon />} variant="outlined" onClick={onBlank}>
        {blankLabel}
      </Button>
    </Stack>
  )
}

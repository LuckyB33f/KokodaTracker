import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import { normaliseMealText } from '../utils/mealText'
import { MEAL_TAG_LABELS } from '../types/mealTypes'
import type { MealLibraryItem } from '../types/mealTypes'

interface MealQuickPickerProps {
  library: MealLibraryItem[]
  onPick: (item: MealLibraryItem) => void
  onNew: (text: string) => void
}

// R11.3: the add flow leads with Recent + Frequent chips — one tap re-logs.
// Search-as-you-type covers the rest; "new meal" is one tap away (R12.4).
export default function MealQuickPicker({
  library,
  onPick,
  onNew,
}: MealQuickPickerProps) {
  const [search, setSearch] = useState('')

  const visible = useMemo(
    () => library.filter((item) => !item.hidden),
    [library],
  )

  const recent = useMemo(
    () =>
      [...visible]
        .sort((a, b) => (b.lastUsedAtMs ?? 0) - (a.lastUsedAtMs ?? 0))
        .slice(0, 10),
    [visible],
  )

  const frequent = useMemo(
    () =>
      [...visible]
        .filter((item) => item.useCount > 1)
        .sort((a, b) => b.useCount - a.useCount)
        .slice(0, 10),
    [visible],
  )

  const needle = normaliseMealText(search)
  const results = needle
    ? visible.filter((item) => item.normalisedText.includes(needle))
    : []

  return (
    <Stack spacing={2}>
      <TextField
        autoFocus
        label="Search your meals"
        placeholder="e.g. porridge"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputProps={{ maxLength: 200 }}
      />

      {needle ? (
        <>
          {results.length > 0 ? (
            <List disablePadding>
              {results.slice(0, 20).map((item) => (
                <ListItemButton key={item.id} onClick={() => onPick(item)}>
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {item.favourite && (
                          <StarIcon sx={{ fontSize: 16 }} color="warning" />
                        )}
                        {item.text}
                      </Box>
                    }
                    secondary={item.tag ? MEAL_TAG_LABELS[item.tag] : undefined}
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing in your library matches.
            </Typography>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => onNew(search.trim())}
          >
            New meal “{search.trim()}”
          </Button>
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <div>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Recent
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {recent.map((item) => (
                  <Chip
                    key={item.id}
                    label={item.text}
                    icon={item.favourite ? <StarIcon /> : undefined}
                    onClick={() => onPick(item)}
                  />
                ))}
              </Box>
            </div>
          )}
          {frequent.length > 0 && (
            <div>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Frequent
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {frequent.map((item) => (
                  <Chip
                    key={item.id}
                    label={`${item.text} ×${item.useCount}`}
                    variant="outlined"
                    onClick={() => onPick(item)}
                  />
                ))}
              </Box>
            </div>
          )}
          {visible.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Meals you log are saved here so you never retype them.
            </Typography>
          )}
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            onClick={() => onNew('')}
          >
            New meal
          </Button>
        </>
      )}
    </Stack>
  )
}

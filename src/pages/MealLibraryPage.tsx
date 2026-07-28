import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import EmptyState from '@/components/common/EmptyState'
import LoadingState from '@/components/common/LoadingState'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import ActionButton from '@/components/common/ActionButton'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'
import {
  useGetMealLibraryQuery,
  useRenameLibraryItemMutation,
  useSetLibraryItemFlagsMutation,
} from '@/services/mealApi'
import { normaliseMealText } from '@/features/meals/utils/mealText'
import { MEAL_TAG_LABELS } from '@/features/meals/types/mealTypes'
import type { MealLibraryItem } from '@/features/meals/types/mealTypes'

export default function MealLibraryPage() {
  const user = useAppSelector(selectAuthUser)
  const { data: library = [], isLoading } = useGetMealLibraryQuery(
    user?.uid ?? '',
    { skip: !user },
  )
  const [setFlags] = useSetLibraryItemFlagsMutation()
  const [renameItem, { isLoading: renaming }] = useRenameLibraryItemMutation()
  const [search, setSearch] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuItem, setMenuItem] = useState<MealLibraryItem | null>(null)
  const [renaming_, setRenaming] = useState<MealLibraryItem | null>(null)
  const [renameText, setRenameText] = useState('')

  const needle = normaliseMealText(search)
  const items = useMemo(() => {
    const filtered = needle
      ? library.filter((item) => item.normalisedText.includes(needle))
      : library
    return [...filtered].sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden ? 1 : -1
      if (a.favourite !== b.favourite) return a.favourite ? -1 : 1
      return b.useCount - a.useCount
    })
  }, [library, needle])

  if (!user || isLoading) {
    return (
      <PageContainer>
        <SEO title="Meal library" noindex />
        <LoadingState label="Loading your meal library…" />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SEO title="Meal library" noindex />
      <PageHeader
        title="Meal library"
        subtitle="Everything you've logged — rename, favourite, or hide."
        action={
          <Button
            component={RouterLink}
            to="/food"
            startIcon={<ArrowBackIcon />}
          >
            Food diary
          </Button>
        }
      />
      <SectionCard>
        <TextField
          fullWidth
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 1 }}
        />
        {items.length === 0 ? (
          <EmptyState
            icon={<RestaurantMenuIcon color="disabled" sx={{ fontSize: 40 }} />}
            title={library.length === 0 ? 'No meals yet' : 'No matches'}
            description={
              library.length === 0
                ? 'Meals you log are saved here automatically.'
                : 'Try a different search.'
            }
          />
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <ListItem
                key={item.id}
                disableGutters
                sx={item.hidden ? { opacity: 0.5 } : undefined}
                secondaryAction={
                  <>
                    <IconButton
                      aria-label={
                        item.favourite
                          ? `Unfavourite ${item.text}`
                          : `Favourite ${item.text}`
                      }
                      onClick={() =>
                        void setFlags({
                          itemId: item.id,
                          patch: { favourite: !item.favourite },
                        })
                      }
                      sx={{ width: 44, height: 44 }}
                    >
                      {item.favourite ? (
                        <StarIcon color="warning" />
                      ) : (
                        <StarBorderIcon />
                      )}
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label={`Options for ${item.text}`}
                      onClick={(event) => {
                        setMenuAnchor(event.currentTarget)
                        setMenuItem(item)
                      }}
                      sx={{ width: 44, height: 44 }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </>
                }
              >
                <ListItemText
                  primary={item.text}
                  secondary={[
                    `Logged ${item.useCount}×`,
                    item.tag ? MEAL_TAG_LABELS[item.tag] : null,
                    item.hidden ? 'Hidden' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}
      </SectionCard>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuItem) {
              setRenaming(menuItem)
              setRenameText(menuItem.text)
            }
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null)
            if (menuItem) {
              void setFlags({
                itemId: menuItem.id,
                patch: { hidden: !menuItem.hidden },
              })
            }
          }}
        >
          {menuItem?.hidden ? 'Unhide' : 'Hide'}
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(renaming_)}
        onClose={() => setRenaming(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Rename meal</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Meal"
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            inputProps={{ maxLength: 200 }}
            sx={{ mt: 1 }}
            helperText="Past entries keep their original wording; new taps use the new name."
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
          <ActionButton
            fullWidth={false}
            loading={renaming}
            disabled={!renameText.trim()}
            onClick={() => {
              if (renaming_ && renameText.trim()) {
                void renameItem({
                  itemId: renaming_.id,
                  text: renameText,
                }).then(() => setRenaming(null))
              }
            }}
          >
            Save
          </ActionButton>
        </DialogActions>
      </Dialog>
    </PageContainer>
  )
}

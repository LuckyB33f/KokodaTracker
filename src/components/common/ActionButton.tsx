import Button, { type ButtonProps } from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

interface ActionButtonProps extends ButtonProps {
  loading?: boolean
}

export default function ActionButton({
  loading = false,
  disabled,
  children,
  ...rest
}: ActionButtonProps) {
  return (
    <Button
      variant="contained"
      fullWidth
      disabled={disabled || loading}
      startIcon={
        loading ? <CircularProgress size={18} color="inherit" /> : undefined
      }
      {...rest}
    >
      {children}
    </Button>
  )
}

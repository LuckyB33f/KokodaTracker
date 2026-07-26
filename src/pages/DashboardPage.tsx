import Typography from '@mui/material/Typography'
import PageContainer from '@/components/common/PageContainer'
import PageHeader from '@/components/common/PageHeader'
import SectionCard from '@/components/common/SectionCard'
import SEO from '@/components/common/SEO'
import { useAppSelector } from '@/app/hooks'
import { selectAuthUser } from '@/features/auth/authSlice'

// Placeholder shell — the real dashboard (countdown, phase banner, weekly
// progress) is feature F6.
export default function DashboardPage() {
  const user = useAppSelector(selectAuthUser)
  const firstName = user?.displayName?.split(' ')[0]

  return (
    <PageContainer>
      <SEO title="Dashboard" noindex />
      <PageHeader
        title={firstName ? `G'day, ${firstName}` : 'Dashboard'}
        subtitle="Kokoda Challenge Brisbane — June 2027"
      />
      <SectionCard title="Training dashboard">
        <Typography variant="body2" color="text.secondary">
          Your team dashboard — event countdown, weekly progress and the
          virtual Kokoda tracker — arrives with feature F6. Next up: create or
          join your team (F2).
        </Typography>
      </SectionCard>
    </PageContainer>
  )
}

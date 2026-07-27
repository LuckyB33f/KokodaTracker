import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import GroupIcon from '@mui/icons-material/Group'
import EmptyState from '@/components/common/EmptyState'
import SectionCard from '@/components/common/SectionCard'
import { useGetTeamMembersQuery } from '@/services/teamApi'

export default function TeamMembersList({ teamId }: { teamId: string }) {
  const { data: members = [] } = useGetTeamMembersQuery(teamId)

  return (
    <SectionCard title={`Members (${members.length}/5)`}>
      {members.length === 0 ? (
        <EmptyState
          icon={<GroupIcon color="disabled" sx={{ fontSize: 40 }} />}
          title="No members yet"
          description="Share the invite code to get your crew on board."
        />
      ) : (
        <List disablePadding>
          {members.map((member) => (
            <ListItem key={member.uid} disableGutters>
              <ListItemAvatar>
                <Avatar src={member.photoURL ?? undefined}>
                  {member.displayName.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.displayName}
                secondary={`Target ${member.weeklyTargetHours}h/week`}
              />
              {member.isCaptain && (
                <Chip label="Captain" size="small" color="primary" />
              )}
            </ListItem>
          ))}
        </List>
      )}
    </SectionCard>
  )
}

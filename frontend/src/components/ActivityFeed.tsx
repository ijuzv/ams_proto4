import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDiceBearAvatar } from '@/lib/utils';
import { format } from 'date-fns';
import { UserAvatar } from './avatar/UserAvatar';

interface Activity {
  id: number;
  type: string;
  userName: string;
  userEmail: string;
  userId?: number;
  userGender?: string | null;
  userAvatar?: string | null;
  leaveType?: string;
  leaveStatus?: string;
  timestamp: string | Date;
  status?: string;
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-center">
                <UserAvatar
                  avatar={activity.userAvatar}
                  name={activity.userName || 'User'}
                  size="md"
                />
                <div className="ml-4 space-y-1 flex-1">
                  <p className="text-sm font-medium leading-none">{activity.userName || 'Unknown User'}</p>
                  <p className="text-sm text-muted-foreground">
                    {activity.leaveType ? `${activity.leaveType} Leave` : activity.type === 'LEAVE_REQUEST' ? 'Requested Leave' : 'Leave Updated'} - {activity.leaveStatus || activity.status || 'N/A'}
                  </p>
                </div>
                <div className="ml-auto font-medium text-sm text-muted-foreground">
                  {format(new Date(activity.timestamp), 'MMM dd, yyyy')}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

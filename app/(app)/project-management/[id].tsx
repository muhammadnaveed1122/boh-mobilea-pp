import { useLocalSearchParams } from 'expo-router';

import { ProjectManagementDetailScreen } from '@/features/projects/components/ProjectManagementDetailScreen';

export default function ProjectManagementDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectManagementDetailScreen id={id} />;
}

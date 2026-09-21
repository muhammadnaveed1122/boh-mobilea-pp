import { useLocalSearchParams } from 'expo-router';
import { ProjectDetailScreen } from '@/features/new-projects/components/ProjectDetailScreen';

export default function NewProjectDetailRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ProjectDetailScreen slug={slug} />;
}

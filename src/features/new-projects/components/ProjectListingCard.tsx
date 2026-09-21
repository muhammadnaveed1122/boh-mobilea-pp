import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { PublicProjectListItem } from '../types';
import { ProjectCardProvider } from './listing-card/ProjectCardContext';
import { ProjectCardBody } from './listing-card/ProjectCardBody';
import { ProjectCardOverlay } from './listing-card/ProjectCardOverlay';
import { ProjectImageCarousel } from './listing-card/ProjectImageCarousel';

interface Props {
  project: PublicProjectListItem;
}

export function ProjectListingCard({ project }: Readonly<Props>) {
  return (
    <ProjectCardProvider project={project}>
      {/*
        The carousel stays outside the Pressable: a Pressable wrapping a
        horizontal FlatList wins the touch responder, so swipes never land.
      */}
      <ProjectImageCarousel>
        <ProjectCardOverlay />
      </ProjectImageCarousel>
      <Pressable
        onPress={() => router.push(`/new-projects/${project.slug}`)}
        accessibilityRole="button"
        accessibilityLabel={project.projectName}
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      >
        <ProjectCardBody />
      </Pressable>
    </ProjectCardProvider>
  );
}

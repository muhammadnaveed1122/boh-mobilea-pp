import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PublicProjectListItem } from '../../types';

interface ProjectCardContextValue {
  project: PublicProjectListItem;
  images: string[];
}

const ProjectCardContext = createContext<ProjectCardContextValue | null>(null);

function collectImages(project: PublicProjectListItem): string[] {
  const urls: string[] = [];
  if (project.heroPrimaryImageUrl) urls.push(project.heroPrimaryImageUrl);
  for (const img of project.heroImageUrl ?? []) {
    if (img?.img_url && !urls.includes(img.img_url)) urls.push(img.img_url);
  }
  return urls;
}

interface ProviderProps {
  project: PublicProjectListItem;
  children: ReactNode;
}

export function ProjectCardProvider({ project, children }: Readonly<ProviderProps>) {
  const value = useMemo<ProjectCardContextValue>(
    () => ({ project, images: collectImages(project) }),
    [project],
  );
  return <ProjectCardContext.Provider value={value}>{children}</ProjectCardContext.Provider>;
}

export function useProjectCard(): ProjectCardContextValue {
  const ctx = useContext(ProjectCardContext);
  if (!ctx) throw new Error('useProjectCard must be used within ProjectCardProvider');
  return ctx;
}

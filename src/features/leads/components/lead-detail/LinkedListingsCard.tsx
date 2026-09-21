import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/molecules/Card';
import type { LeadDetail, LinkedListing, LinkedProject } from '@/features/leads/models/lead-detail';
import { cn } from '@/lib/utils';

type SubTab = 'listings' | 'projects';

interface StatusStyle {
  readonly container: string;
  readonly text: string;
}

const STATUS_STYLES: Readonly<Record<string, StatusStyle>> = {
  published: { container: 'bg-success-soft', text: 'text-success' },
  draft: { container: 'bg-muted', text: 'text-muted-foreground' },
  archived: { container: 'bg-destructive-soft', text: 'text-destructive' },
};

const FALLBACK_STATUS: StatusStyle = {
  container: 'bg-muted',
  text: 'text-muted-foreground',
};

function normaliseStatus(status: string | undefined): string | undefined {
  if (status === undefined) return undefined;
  return status.trim().toLowerCase();
}

function titleCase(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function StatusPill({ status }: Readonly<{ status?: string }>) {
  if (status === undefined || status.length === 0) return null;
  const normalised = normaliseStatus(status) ?? '';
  const style = STATUS_STYLES[normalised] ?? FALLBACK_STATUS;
  return (
    <View className={cn('rounded-full px-2 py-0.5', style.container)}>
      <Text className={cn('text-xs font-semibold', style.text)}>{titleCase(status)}</Text>
    </View>
  );
}

function CountBadge({ count }: Readonly<{ count: number }>) {
  return (
    <View className="h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5">
      <Text className="text-xs font-semibold text-background">{count}</Text>
    </View>
  );
}

function SubTabs({
  active,
  onChange,
}: Readonly<{ active: SubTab; onChange: (tab: SubTab) => void }>) {
  return (
    <View className="flex-row border-b border-border">
      <Pressable
        onPress={() => onChange('listings')}
        className={cn(
          'mr-4 border-b-2 px-1 pb-2',
          active === 'listings' ? 'border-foreground' : 'border-transparent',
        )}
      >
        <Text
          className={cn(
            'text-sm font-semibold',
            active === 'listings' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          Listings
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('projects')}
        className={cn(
          'border-b-2 px-1 pb-2',
          active === 'projects' ? 'border-foreground' : 'border-transparent',
        )}
      >
        <Text
          className={cn(
            'text-sm font-semibold',
            active === 'projects' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          Projects
        </Text>
      </Pressable>
    </View>
  );
}

function RowThumbnail({ uri, alt }: Readonly<{ uri?: string; alt: string }>) {
  if (uri === undefined || uri.length === 0) {
    return (
      <View className="h-14 w-14 items-center justify-center rounded-xl bg-muted">
        <Icon name="Image" size={20} />
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={alt}
      source={{ uri }}
      className="h-14 w-14 rounded-xl bg-muted"
      resizeMode="cover"
    />
  );
}

function ListingSubtitle({ listing }: Readonly<{ listing: LinkedListing }>) {
  const parts = [listing.developerName, listing.projectName].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  if (parts.length === 0) return null;
  return (
    <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
      {parts.join(' — ')}
    </Text>
  );
}

function resolveListingKind(listing: LinkedListing): 'primary' | 'secondary' {
  if (listing.kind !== undefined) return listing.kind;
  // Fallback for older payloads without `kind`: primary listings carry a real
  // project name; opportunity (secondary) ones come through with it blank.
  return listing.projectName !== undefined && listing.projectName.length > 0
    ? 'primary'
    : 'secondary';
}

function ListingRow({ listing }: Readonly<{ listing: LinkedListing }>) {
  const thumb = listing.heroUrl ?? listing.imageUrl;
  const handlePress = (): void => {
    router.push({
      pathname: '/listings/[id]',
      params: { id: listing.id, kind: resolveListingKind(listing) },
    });
  };
  return (
    <Pressable onPress={handlePress} className="flex-row items-center gap-3 py-3 active:opacity-70">
      <RowThumbnail uri={thumb} alt={listing.title} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {listing.title}
        </Text>
        <ListingSubtitle listing={listing} />
        {listing.type !== undefined && listing.type.length > 0 ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {titleCase(listing.type)}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <StatusPill status={listing.status} />
      </View>
    </Pressable>
  );
}

function ProjectRow({ project }: Readonly<{ project: LinkedProject }>) {
  const handlePress = (): void => {
    // `/project-management/[id]` is the API-backed detail (getProjectById);
    // `/projects/[id]` is a static mock stub and won't resolve real ids.
    router.push(`/project-management/${project.id}`);
  };
  return (
    <Pressable onPress={handlePress} className="flex-row items-center gap-3 py-3 active:opacity-70">
      <RowThumbnail uri={project.heroUrl} alt={project.projectName} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {project.projectName}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {project.developerName}
        </Text>
      </View>
      <Icon name="ChevronRight" size={18} />
    </Pressable>
  );
}

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <View className="items-center gap-2 py-8">
      <Icon name="Inbox" size={24} />
      <Text variant="muted">{label}</Text>
    </View>
  );
}

function RowSeparator() {
  return <View className="h-px bg-border" />;
}

function ListingsList({ listings }: Readonly<{ listings: readonly LinkedListing[] }>) {
  if (listings.length === 0) {
    return <EmptyState label="No linked listings" />;
  }
  return (
    <View>
      {listings.map((listing, index) => (
        <View key={listing.id}>
          <ListingRow listing={listing} />
          {index < listings.length - 1 ? <RowSeparator /> : null}
        </View>
      ))}
    </View>
  );
}

function ProjectsList({ projects }: Readonly<{ projects: readonly LinkedProject[] }>) {
  if (projects.length === 0) {
    return <EmptyState label="No linked projects" />;
  }
  return (
    <View>
      {projects.map((project, index) => (
        <View key={project.id}>
          <ProjectRow project={project} />
          {index < projects.length - 1 ? <RowSeparator /> : null}
        </View>
      ))}
    </View>
  );
}

export interface LinkedListingsCardProps {
  readonly lead: LeadDetail;
}

export function LinkedListingsCard({ lead }: Readonly<LinkedListingsCardProps>) {
  const [tab, setTab] = useState<SubTab>('listings');
  const listings = lead.linkedListings ?? lead.listings ?? [];
  const projects = lead.projects ?? [];
  const total = listings.length + projects.length;

  return (
    <Card className="rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-brand">Linked Listings & Projects</Text>
        <CountBadge count={total} />
      </View>
      <Text className="mt-1 text-xs text-muted-foreground">
        Monitor lead interests and reach out to clients directly from their favorited listings and
        projects.
      </Text>
      <View className="mt-4">
        <SubTabs active={tab} onChange={setTab} />
      </View>
      <View className="mt-2">
        {tab === 'listings' ? (
          <ListingsList listings={listings} />
        ) : (
          <ProjectsList projects={projects} />
        )}
      </View>
    </Card>
  );
}

import type {
  BrowseConfig,
  BrowseState,
  ChannelTab,
  LeadPriority,
  LeadStatus,
  LeadsQuery,
  MarketTab,
  PortalSource,
  AssignmentFilter,
} from '../../types';

export const browseInitialState: BrowseState = {
  search: '',
  stage: null,
  marketTab: 'all',
  channelTab: 'all',
  portalSource: null,
  priority: null,
  assignment: 'all',
  assigneeId: null,
};

export function channelTabToPf(tab: ChannelTab): 'whatsapp' | 'call' | 'email' | undefined {
  if (tab === 'whatsapp') return 'whatsapp';
  if (tab === 'calls') return 'call';
  if (tab === 'emails') return 'email';
  return undefined;
}

/** Build the leads list query from config + filter state + the debounced search. */
export function buildBrowseQuery(
  config: BrowseConfig,
  state: BrowseState,
  debouncedSearch: string,
): LeadsQuery {
  const base: LeadsQuery = {
    search: debouncedSearch || undefined,
    status: state.stage ?? undefined,
    priority: state.priority ?? undefined,
    isAssigned: state.assignment === 'all' ? undefined : state.assignment === 'assigned',
    assigneeId: state.assigneeId ?? undefined,
  };
  if (config.mode === 'newProject') {
    // Cuts ACROSS channel and intent, so nothing else is pinned — the stage chips,
    // search and filter sheet still narrow it further.
    return { ...base, newProject: true };
  }
  if (config.mode === 'intent') {
    return {
      ...base,
      intentBucket: config.intentBucket,
      hasLink: state.marketTab === 'all' ? undefined : state.marketTab === 'primary',
    };
  }
  return {
    ...base,
    isPortal: true,
    pfChannel: channelTabToPf(state.channelTab),
    portalSource: state.portalSource ?? undefined,
  };
}

/** Count of non-default filters for the Filters button badge. */
export function activeFilterCount(state: BrowseState): number {
  let n = 0;
  if (state.priority) n++;
  if (state.assignment !== 'all') n++;
  if (state.assigneeId) n++;
  if (state.portalSource) n++;
  return n;
}

export type BrowseAction =
  | { type: 'search'; value: string }
  | { type: 'stage'; value: LeadStatus | null }
  | { type: 'marketTab'; value: MarketTab }
  | { type: 'channelTab'; value: ChannelTab }
  | { type: 'portalSource'; value: PortalSource | null }
  | { type: 'priority'; value: LeadPriority | null }
  | { type: 'assignment'; value: AssignmentFilter }
  | { type: 'assigneeId'; value: string | null }
  | { type: 'clearFilters' };

export function browseReducer(state: BrowseState, action: BrowseAction): BrowseState {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.value };
    case 'stage':
      return { ...state, stage: action.value };
    case 'marketTab':
      return { ...state, marketTab: action.value };
    case 'channelTab':
      return { ...state, channelTab: action.value };
    case 'portalSource':
      return { ...state, portalSource: action.value };
    case 'priority':
      return { ...state, priority: action.value };
    case 'assignment':
      return { ...state, assignment: action.value };
    case 'assigneeId':
      return { ...state, assigneeId: action.value };
    case 'clearFilters':
      return { ...state, priority: null, assignment: 'all', assigneeId: null, portalSource: null };
    default:
      return state;
  }
}

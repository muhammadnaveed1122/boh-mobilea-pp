import { useAppForm } from '@/components/molecules/forms';
import {
  LISTING_CALLBACK_DEFAULTS,
  listingCallbackSchema,
  type ListingCallbackFormValues,
} from './listing-callback.schema';

interface UseListingCallbackFormOptions {
  onSubmit: (values: ListingCallbackFormValues) => Promise<void>;
}

export function useListingCallbackForm({ onSubmit }: UseListingCallbackFormOptions) {
  return useAppForm({
    defaultValues: LISTING_CALLBACK_DEFAULTS,
    validators: { onSubmit: listingCallbackSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });
}

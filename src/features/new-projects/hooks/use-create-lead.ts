import { useMutation } from '@tanstack/react-query';
import { createLead, downloadBrochure } from '../services/leads';

export function useCreateLead() {
  return useMutation({ mutationFn: createLead });
}

export function useDownloadBrochure() {
  return useMutation({ mutationFn: downloadBrochure });
}

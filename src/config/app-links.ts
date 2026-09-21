import appLinks from './app-links.json';

/**
 * Externally-configurable app links + support contact.
 *
 * Edit `app-links.json` (sibling) to repoint Terms & Conditions, Privacy Policy,
 * About Us web pages or the Help & Support email — no code change required.
 */
export const SUPPORT_EMAIL: string = appLinks.supportEmail;

export const APP_LINKS: Readonly<{
  termsAndConditions: string;
  privacyPolicy: string;
  aboutUs: string;
}> = appLinks.links;

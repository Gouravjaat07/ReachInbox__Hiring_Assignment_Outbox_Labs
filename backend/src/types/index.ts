import type { User, Sender, Campaign, Email } from '@prisma/client';

export type AuthedUser = User;
export type CampaignWithEmails = Campaign & { emails: Email[] };
export type SenderWithCounts = Sender & { sentCount?: number };

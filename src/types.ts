import type { Timestamp } from 'firebase/firestore';

export type Language = 'en' | 'bn';

export type ProposalStatus = 'waiting' | 'opened' | 'said_yes';

export type TreatPayer = 'receiver' | 'sender';

export interface Proposal {
  id: string;
  senderName: string;
  receiverName: string;
  outingTopic: string;
  treatPayer: TreatPayer;
  pin: string;
  status: ProposalStatus;
  noDodges: number;
  treatClicks: number;
  day: string;
  time: string;
  plan: string;
  treatChoice: '' | TreatPayer;
  letter: string;
  createdAt: Timestamp | null;
}

export interface StoredProposalLink {
  proposalId: string;
  pin: string;
  senderName: string;
  receiverName: string;
  outingTopic: string;
  treatPayer: TreatPayer;
  createdAtIso: string;
}

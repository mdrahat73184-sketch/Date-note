import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Language, Proposal, ProposalStatus, TreatPayer } from '../types';

function generateProposalId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateFourDigitPin(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(1000 + (arr[0] % 9000));
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

function mapDocToProposal(id: string, data: Record<string, unknown>): Proposal {
  const rawPayer = data.treatPayer === 'sender' ? 'sender' : 'receiver';
  const rawChoice =
    data.treatChoice === 'sender'
      ? 'sender'
      : data.treatChoice === 'receiver'
        ? 'receiver'
        : '';

  return {
    id,
    senderName: String(data.senderName ?? ''),
    receiverName: String(data.receiverName ?? ''),
    outingTopic: String(data.outingTopic ?? ''),
    treatPayer: rawPayer,
    pin: String(data.pin ?? ''),
    status: (data.status as ProposalStatus) ?? 'waiting',
    noDodges: typeof data.noDodges === 'number' ? data.noDodges : 0,
    treatClicks: typeof data.treatClicks === 'number' ? data.treatClicks : 0,
    day: String(data.day ?? ''),
    time: String(data.time ?? ''),
    plan: String(data.plan ?? ''),
    treatChoice: rawChoice,
    letter: String(data.letter ?? ''),
    createdAt: (data.createdAt as Proposal['createdAt']) ?? null,
  };
}

export async function createProposal(
  senderName: string,
  receiverName: string,
  options?: {
    optionalPin?: string;
    outingTopic?: string;
    treatPayer?: TreatPayer;
  },
): Promise<{ proposalId: string; pin: string }> {
  const cleanSender = senderName.trim().slice(0, 60);
  const cleanReceiver = receiverName.trim().slice(0, 60);
  const cleanTopic = (options?.outingTopic ?? '').trim().slice(0, 80);
  const treatPayer: TreatPayer = options?.treatPayer === 'sender' ? 'sender' : 'receiver';
  const trimmedPin = (options?.optionalPin ?? '').trim();
  const pin = /^[0-9]{4}$/.test(trimmedPin) ? trimmedPin : generateFourDigitPin();

  if (!cleanSender || !cleanReceiver) {
    throw new Error('Sender and receiver names are required.');
  }

  const proposalId = generateProposalId();
  const path = `proposals/${proposalId}`;

  try {
    await setDoc(doc(db, 'proposals', proposalId), {
      senderName: cleanSender,
      receiverName: cleanReceiver,
      outingTopic: cleanTopic,
      treatPayer,
      pin,
      status: 'waiting',
      noDodges: 0,
      treatClicks: 0,
      day: '',
      time: '',
      plan: '',
      treatChoice: '',
      letter: '',
      createdAt: serverTimestamp(),
    });
    return { proposalId, pin };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchProposal(proposalId: string): Promise<Proposal | null> {
  const path = `proposals/${proposalId}`;
  try {
    const snap = await getDoc(doc(db, 'proposals', proposalId));
    if (!snap.exists()) return null;
    return mapDocToProposal(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToProposal(
  proposalId: string,
  onUpdate: (proposal: Proposal | null) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const path = `proposals/${proposalId}`;
  return onSnapshot(
    doc(db, 'proposals', proposalId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapDocToProposal(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function markProposalOpened(proposalId: string): Promise<void> {
  const path = `proposals/${proposalId}`;
  try {
    await updateDoc(doc(db, 'proposals', proposalId), {
      status: 'opened',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function incrementNoDodges(proposalId: string): Promise<void> {
  const path = `proposals/${proposalId}`;
  try {
    await updateDoc(doc(db, 'proposals', proposalId), {
      noDodges: increment(1),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markProposalSaidYes(proposalId: string): Promise<void> {
  const path = `proposals/${proposalId}`;
  try {
    await updateDoc(doc(db, 'proposals', proposalId), {
      status: 'said_yes',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function incrementTreatClicks(proposalId: string): Promise<void> {
  const path = `proposals/${proposalId}`;
  try {
    await updateDoc(doc(db, 'proposals', proposalId), {
      treatClicks: increment(1),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sealProposal(
  proposalId: string,
  payload: {
    day: string;
    time: string;
    plan: string;
    treatChoice: TreatPayer;
    letter: string;
  },
): Promise<void> {
  const path = `proposals/${proposalId}`;
  try {
    await updateDoc(doc(db, 'proposals', proposalId), {
      day: payload.day.trim().slice(0, 60),
      time: payload.time.trim().slice(0, 60),
      plan: payload.plan.trim().slice(0, 120),
      treatChoice: payload.treatChoice,
      letter: payload.letter.trim().slice(0, 4000),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function generateLetter(params: {
  senderName: string;
  receiverName: string;
  outingTopic: string;
  day: string;
  time: string;
  plan: string;
  treatPayer: TreatPayer;
  treatChoice: TreatPayer;
  treatClicks: number;
  noDodges: number;
  lang: Language;
}): Promise<string> {
  const res = await fetch('/api/generate-letter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as { letter?: string; error?: string };
  if (!res.ok || !data.letter) {
    throw new Error(data.error || 'Could not generate the letter right now.');
  }
  return data.letter;
}

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

function buildStaticFallbackLetter(params: {
  senderName: string;
  receiverName: string;
  outingTopic: string;
  day: string;
  time: string;
  plan: string;
  treatPayer: TreatPayer;
  treatClicks: number;
  noDodges: number;
  lang: Language;
}): string {
  const {
    senderName,
    receiverName,
    outingTopic,
    day,
    time,
    plan,
    treatPayer,
    treatClicks,
    noDodges,
    lang,
  } = params;

  if (lang === 'bn') {
    const dodgeLine =
      noDodges > 0
        ? `তুমি "না" বাটনটার পেছনে ${noDodges} বার ছুটলেও শেষ পর্যন্ত "হ্যাঁ" বলেছ দেখে সত্যিই খুব খুশি হয়েছি!`
        : `এক ক্লিকেই "হ্যাঁ" বলে দেওয়ায় আমার পুরো দিনটাই সুন্দর হয়ে গেছে!`;
    const treatLine =
      treatPayer === 'sender'
        ? treatClicks > 0
          ? `তুমি ${treatClicks} বার নিজে বিল দিতে চাইলেও আজকের ${plan}-এর ট্রিটটা কিন্তু আমারই থাকল—পরের বার নাহয় তুমি দিও।`
          : `আজকের ${plan}-এর পুরো ট্রিটটা আমার পক্ষ থেকে, তুমি শুধু সময়মতো চলে এসো।`
        : treatClicks > 0
          ? `আমাকে দিয়ে ট্রিট দেওয়ানোর ${treatClicks} বার চেষ্টার পরও শেষমেশ ট্রিটটা কিন্তু তোমারই রইল!`
          : `নিজে থেকেই ট্রিট দেওয়ার দায়িত্ব নেওয়ায় তোমাকে অসংখ্য ধন্যবাদ!`;
    return [
      `প্রিয় ${receiverName},`,
      '',
      dodgeLine,
      `${day} তারিখে ${time} সময়ে আমাদের ${outingTopic || 'আড্ডা'} (${plan}) একসাথে দারুণ কাটবে বলে আশা করছি।`,
      treatLine,
      '',
      `তোমার (একটু নার্ভাস হয়ে),`,
      `— ${senderName}`,
    ].join('\n');
  }

  const dodgeLine =
    noDodges > 0
      ? `Even after chasing the "No" button ${noDodges} time(s), seeing you say YES made my whole week.`
      : `You saying YES right away made my heart do a very uncool happy dance.`;
  const treatLine =
    treatPayer === 'sender'
      ? treatClicks > 0
        ? `And yes, even though you tried to pay ${treatClicks} time(s), this treat is on me—you can get the next one.`
        : `No arguing about the bill either—this treat is happily on me.`
      : treatClicks > 0
        ? `Also, after ${treatClicks} attempt(s) to make me pay, I am officially looking forward to your treat!`
        : `Also, thank you for generously claiming the treat without a single hesitation!`;

  return [
    `Dear ${receiverName},`,
    '',
    dodgeLine,
    `I already have ${day} at ${time} circled in my head for our ${outingTopic || 'date'} (${plan}).`,
    treatLine,
    '',
    `Yours (a little nervously),`,
    `— ${senderName}`,
  ].join('\n');
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
  try {
    const res = await fetch('/api/generate-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.status === 404 || res.status === 405) {
      return buildStaticFallbackLetter(params);
    }

    const rawText = await res.text();
    let data: { letter?: string; error?: string } = {};
    try {
      data = JSON.parse(rawText) as { letter?: string; error?: string };
    } catch {
      if (!res.ok) {
        return buildStaticFallbackLetter(params);
      }
    }

    if (!res.ok || !data.letter) {
      throw new Error(data.error || 'Could not generate the letter right now.');
    }
    return data.letter;
  } catch (err) {
    if (err instanceof TypeError) {
      return buildStaticFallbackLetter(params);
    }
    throw err;
  }
}

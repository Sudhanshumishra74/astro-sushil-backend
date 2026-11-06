import { Counter } from "../modules/Counter/counter.model.js";

// Atomically claims the next number in a named sequence — a single
// findOneAndUpdate round-trip, so two concurrent requests can never be
// handed the same number.
async function getNextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  );
  return counter.seq;
}

const pad = (seq) => String(seq).padStart(3, "0");

export const formatInvoiceNumber = (seq) => `INV-${pad(seq)}`;
export const formatCreditNoteNumber = (seq) => `CN-${pad(seq)}`;

// Assigns a document's invoice/credit-note number exactly once, the first
// time it's actually needed (invoice/credit-note first viewed or
// downloaded) — every later call reuses the same persisted value instead of
// generating a new one, so the number on a document never changes once
// printed.
//
// The claim itself (`findOneAndUpdate` with `field` still unset in the
// filter) is atomic, so two concurrent requests for the *same* document
// (e.g. a double-click) can't both "win" and each save a different number —
// the loser re-reads whatever the winner actually persisted instead of
// returning its own now-unused sequence value. `doc` is only used to read
// the current value and, on the fast path, to avoid a query entirely.
//
// Two separate documents racing for the *same counter* each still get a
// distinct number (that's the whole point of the atomic $inc above); the
// only acceptable imperfection is a request crashing between the increment
// and the save, which burns a sequence number without assigning it — a rare
// gap, not a correctness bug, since this is a display convenience rather
// than a legally-audited gapless ledger.
export async function ensureSequenceNumber(Model, doc, { field, counterKey, formatter }) {
  if (doc[field]) return doc[field];

  const seq = await getNextSequence(counterKey);
  const value = formatter(seq);

  const claimed = await Model.findOneAndUpdate(
    { _id: doc._id, [field]: { $in: [null, undefined] } },
    { $set: { [field]: value } },
    { returnDocument: "after" },
  ).select(field);

  if (claimed) {
    doc[field] = claimed[field];
  } else {
    // Someone else claimed it between our read and our write attempt.
    const fresh = await Model.findById(doc._id).select(field);
    doc[field] = fresh?.[field] || value;
  }

  return doc[field];
}

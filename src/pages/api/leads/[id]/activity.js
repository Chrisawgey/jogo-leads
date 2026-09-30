import { requireSession } from "../../../../lib/session";
import { leadsCollection, isValidStatus, serializeLead, FieldValue } from "../../../../lib/leads-server";

// Log a status change and/or a note against a lead
export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ref = leadsCollection().doc(String(req.query.id));

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const previousStatus = snap.data().status;
    const status = isValidStatus(req.body?.status) ? req.body.status : previousStatus;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 4000) : "";

    if (status === previousStatus && !note) {
      return res.status(400).json({ error: "Nothing to log" });
    }

    await ref.update({
      status,
      history: FieldValue.arrayUnion({
        type: status === previousStatus ? "note" : "status",
        from: previousStatus,
        status,
        note,
        by: session.name,
        at: new Date().toISOString()
      }),
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.name
    });

    return res.status(200).json({ lead: serializeLead(await ref.get()) });
  } catch (error) {
    console.error("Lead activity error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

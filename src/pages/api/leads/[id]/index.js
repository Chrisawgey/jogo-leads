import { requireSession } from "../../../../lib/session";
import { leadsCollection, pickLeadFields, serializeLead, FieldValue } from "../../../../lib/leads-server";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const ref = leadsCollection().doc(String(req.query.id));

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Lead not found" });
    }

    if (req.method === "PUT") {
      const fields = pickLeadFields(req.body);
      if (!fields.crewName) {
        return res.status(400).json({ error: "Crew name is required" });
      }

      const update = {
        ...fields,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.name
      };

      const previousStatus = snap.data().status;
      if (previousStatus !== fields.status) {
        update.history = FieldValue.arrayUnion({
          type: "status",
          from: previousStatus,
          status: fields.status,
          by: session.name,
          at: new Date().toISOString()
        });
        update.lastActivityAt = FieldValue.serverTimestamp();
      }

      await ref.update(update);
      return res.status(200).json({ lead: serializeLead(await ref.get()) });
    }

    if (req.method === "DELETE") {
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Lead API error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

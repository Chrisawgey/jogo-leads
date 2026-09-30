import { requireSession } from "../../../lib/session";
import { leadsCollection, pickLeadFields, listLeads, serializeLead, FieldValue } from "../../../lib/leads-server";

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    if (req.method === "GET") {
      return res.status(200).json({ leads: await listLeads() });
    }

    if (req.method === "POST") {
      const fields = pickLeadFields(req.body);
      if (!fields.crewName) {
        return res.status(400).json({ error: "Crew name is required" });
      }

      const ref = await leadsCollection().add({
        ...fields,
        owner: fields.owner || session.name,
        history: [{
          type: "created",
          status: fields.status,
          by: session.name,
          at: new Date().toISOString()
        }],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: session.name,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.name,
        lastActivityAt: FieldValue.serverTimestamp()
      });

      return res.status(201).json({ lead: serializeLead(await ref.get()) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Leads API error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

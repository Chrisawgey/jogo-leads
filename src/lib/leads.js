// src/lib/leads.js
// Pipeline stages for crews we're recruiting onto Jogo, in funnel order.
// `color` is used only for the small status dot, map marker and pipeline bar.

export const LEADS_COLLECTION = "crew-leads";

export const LEAD_STATUSES = [
  { id: "new", label: "New lead", color: "#94a3b8" },
  { id: "contacted", label: "Contacted", color: "#3b82f6" },
  { id: "in_talks", label: "In talks", color: "#d97706" },
  { id: "onboarding", label: "Onboarding", color: "#7c3aed" },
  { id: "jogo_running", label: "Running on Jogo", color: "#059669" },
  { id: "not_responding", label: "Not responding", color: "#ea580c" },
  { id: "not_interested", label: "Not interested", color: "#dc2626" },
];

export const getLeadStatus = (id) =>
  LEAD_STATUSES.find(s => s.id === id) || LEAD_STATUSES[0];

// Stages that still count as an active conversation
export const OPEN_STATUSES = ["new", "contacted", "in_talks", "onboarding"];

// Where we found / reach the crew. `handle` is whatever the team pastes:
// @handle, page name, phone number, or a full link.
const isUrl = (h) => /^https?:\/\//i.test(h);

export const LEAD_SOURCES = [
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@handle",
    link: (h) => isUrl(h) ? h : `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "Page or group name, or link",
    link: (h) => isUrl(h) ? h : `https://facebook.com/${h.replace(/^@/, "").replace(/\s+/g, "")}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    placeholder: "Phone number or group invite link",
    link: (h) => isUrl(h) ? h : (h.replace(/\D/g, "") ? `https://wa.me/${h.replace(/\D/g, "")}` : null),
  },
  {
    id: "other",
    label: "Other",
    placeholder: "Link, referral, event…",
    link: (h) => isUrl(h) ? h : null,
  },
];

export const getLeadSource = (id) =>
  LEAD_SOURCES.find(s => s.id === id) || LEAD_SOURCES[LEAD_SOURCES.length - 1];

// Leads created before `source`/`handle` existed stored an `instagram` field
export const getLeadHandle = (lead) => {
  if (lead.handle) return { source: getLeadSource(lead.source), handle: lead.handle };
  if (lead.instagram) return { source: getLeadSource("instagram"), handle: lead.instagram };
  return null;
};

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE",
  "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

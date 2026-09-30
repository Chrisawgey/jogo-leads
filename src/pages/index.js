import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import {
  LEAD_STATUSES,
  OPEN_STATUSES,
  US_STATES,
  LEAD_SOURCES,
  getLeadSource,
  getLeadHandle,
  getLeadStatus
} from "../lib/leads";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  MessageCircle,
  Link2,
  ChevronDown,
  Users,
  User,
  ArrowLeft,
  Crosshair,
  Clock,
  List,
  Map as MapIcon,
  ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";
import { readSession, SESSION_COOKIE } from "../lib/session";

const LeadsMap = dynamic(() => import("../components/LeadsMap"), {
  ssr: false,
  loading: () => <MapPlaceholder />
});
const LocationPicker = dynamic(
  () => import("../components/LeadsMap").then(m => m.LocationPicker),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

const STALE_DAYS = 14;
const REFRESH_MS = 20000;

const emptyForm = {
  crewName: "",
  contactName: "",
  phone: "",
  email: "",
  source: "instagram",
  handle: "",
  crewSize: "",
  city: "",
  state: "",
  address: "",
  latitude: null,
  longitude: null,
  status: "new",
  owner: "",
  notes: ""
};

export async function getServerSideProps({ req }) {
  const session = await readSession(req.cookies[SESSION_COOKIE]);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  let initialLeads = [];
  try {
    // Server-only import keeps firebase-admin out of the browser bundle
    const { listLeads } = await import("../lib/leads-server");
    initialLeads = await listLeads();
  } catch (error) {
    console.error("Initial leads load failed:", error);
  }

  return { props: { userName: session.name, initialLeads } };
}

// Talks to our own API routes; a 401 means the session expired
const api = async (url, { method = "GET", body } = {}) => {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d;
};

const timeAgo = (value) => {
  const date = toDate(value);
  if (!date) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Matches Tailwind's `lg` breakpoint, where the lead detail sits beside the
// map instead of opening as a full-screen sheet
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
};

const isStale = (lead) => {
  if (!OPEN_STATUSES.includes(lead.status)) return false;
  const last = toDate(lead.lastActivityAt) || toDate(lead.createdAt);
  return last && (Date.now() - last.getTime()) / 86400000 > STALE_DAYS;
};

export default function CrewLeads({ userName, initialLeads = [] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [geocoding, setGeocoding] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const [mapResetKey, setMapResetKey] = useState(0);
  const isDesktop = useIsDesktop();

  const refresh = useCallback(async () => {
    try {
      const { leads } = await api("/api/leads");
      setLeads(leads);
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  }, []);

  // Keep everyone roughly in sync: poll, and refetch when the tab/app regains focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const upsertLead = (lead) =>
    setLeads(prev => [lead, ...prev.filter(l => l.id !== lead.id)]);

  // Lock page scroll behind the form sheet, and behind the lead sheet on phones
  const sheetOpen = showModal || (!isDesktop && Boolean(selectedId));
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(LEAD_STATUSES.map(s => [s.id, 0]));
    leads.forEach(l => { byStatus[getLeadStatus(l.status).id]++; });
    return byStatus;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter(l => {
      if (statusFilter !== "all" && getLeadStatus(l.status).id !== statusFilter) return false;
      if (!term) return true;
      return [l.crewName, l.contactName, l.city, l.state, l.owner, l.handle, l.instagram]
        .some(v => v && v.toLowerCase().includes(term));
    });
  }, [leads, statusFilter, search]);

  const selectedLead = leads.find(l => l.id === selectedId) || null;

  const total = leads.length;
  const running = counts.jogo_running;
  const openCount = OPEN_STATUSES.reduce((sum, id) => sum + counts[id], 0);
  const playersOnJogo = leads
    .filter(l => l.status === "jogo_running")
    .reduce((sum, l) => sum + (parseInt(l.crewSize) || 0), 0);
  const staleCount = leads.filter(isStale).length;

  const openCreate = () => {
    setEditingLead(null);
    setFormData({ ...emptyForm, owner: userName || "" });
    setShowMore(false);
    setShowModal(true);
  };

  const openEdit = (lead) => {
    const existing = getLeadHandle(lead);
    setEditingLead(lead);
    setFormData({
      ...emptyForm,
      ...Object.fromEntries(Object.keys(emptyForm).map(k => [k, lead[k] ?? emptyForm[k]])),
      source: existing?.source.id || emptyForm.source,
      handle: existing?.handle || "",
      crewSize: lead.crewSize?.toString() ?? ""
    });
    setShowMore(Boolean(lead.phone || lead.email || lead.crewSize || lead.address));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLead(null);
    setFormData(emptyForm);
  };

  const setField = (field) => (e) => setFormData(f => ({ ...f, [field]: e.target.value }));

  // Changing where the crew is invalidates the old pin; save re-pins it
  const setLocationField = (field) => (e) =>
    setFormData(f => ({ ...f, [field]: e.target.value, latitude: null, longitude: null }));

  const geocode = async (data) => {
    const address = [data.address, data.city, data.state].filter(s => s && s.trim()).join(", ");
    if (!address) return null;
    return api("/api/geocode", { method: "POST", body: { address } });
  };

  const handleGeocode = async () => {
    try {
      setGeocoding(true);
      const result = await geocode(formData);
      if (!result) {
        toast.error("Enter a city/state or address first");
        return;
      }
      setFormData(f => ({ ...f, latitude: result.latitude, longitude: result.longitude }));
    } catch (error) {
      console.error("Geocode error:", error);
      toast.error("Couldn't find that location. Tap the map to place the pin.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e, { addAnother = false } = {}) => {
    e.preventDefault();

    if (!formData.crewName.trim()) {
      toast.error("Crew name is required");
      return;
    }

    try {
      setSaving(true);

      let { latitude, longitude } = formData;
      if (typeof latitude !== "number" && (formData.city.trim() || formData.address.trim())) {
        try {
          const result = await geocode(formData);
          if (result) ({ latitude, longitude } = result);
        } catch (error) {
          console.error("Auto-pin failed:", error);
          toast("Saved without a map pin — location not found");
        }
      }

      const body = { ...formData, latitude, longitude };

      if (editingLead) {
        const { lead } = await api(`/api/leads/${editingLead.id}`, { method: "PUT", body });
        upsertLead(lead);
        toast.success("Lead updated");
      } else {
        const { lead } = await api("/api/leads", { method: "POST", body });
        upsertLead(lead);
        toast.success(`${lead.crewName} added`);

        if (addAnother) {
          // Keep source/status/location so batches from the same area go fast
          setFormData(f => ({
            ...emptyForm,
            owner: f.owner,
            source: f.source,
            status: f.status,
            city: f.city,
            state: f.state
          }));
          return;
        }
        setSelectedId(lead.id);
      }

      closeModal();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error(error.message || "Failed to save lead");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (lead, status, note = "") => {
    if (status === lead.status && !note.trim()) return;

    try {
      const { lead: updated } = await api(`/api/leads/${lead.id}/activity`, {
        method: "POST",
        body: { status, note }
      });
      upsertLead(updated);
      toast.success(status === lead.status ? "Note added" : `Moved to ${getLeadStatus(status).label}`);
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead");
    }
  };

  const handleDelete = async (lead) => {
    if (!confirm(`Delete "${lead.crewName}"? This can't be undone.`)) return;

    try {
      await api(`/api/leads/${lead.id}`, { method: "DELETE" });
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setSelectedId(null);
      toast.success("Lead deleted");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  return (
    <div>
      <Head>
        <title>Crew Leads | Jogo</title>
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Crew Leads</h1>
            <p className="hidden sm:block text-sm text-slate-500 mt-0.5">
              Crews we&apos;re recruiting onto Jogo, shared across the team.
            </p>
          </div>
          {/* Phones get the floating button instead */}
          <div className="hidden sm:block flex-shrink-0">
            <button onClick={openCreate} className={btnPrimary}>
              <Plus className="h-4 w-4" /> New lead
            </button>
          </div>
        </div>

        {/* Metrics */}
        {/* gap-px over a slate background draws the dividers at any column count */}
        {/* Phones: one compact row with short labels, details hidden */}
        <div className="grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-3 sm:mb-4">
          <Metric label="Total leads" short="Leads" value={total} />
          <Metric label="In progress" short="Active" value={openCount}
            sub={staleCount ? `${staleCount} stale (${STALE_DAYS}d+ quiet)` : "All up to date"} />
          <Metric label="Running on Jogo" short="On Jogo" value={running}
            sub={playersOnJogo ? `~${playersOnJogo} players` : null} accent />
          <Metric label="Conversion" short="Conv." value={total ? `${Math.round((running / total) * 100)}%` : "—"}
            sub="Running ÷ total" />
        </div>

        {/* Pipeline + filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
          {total > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 mb-3">
              {LEAD_STATUSES.filter(s => counts[s.id]).map(s => (
                <div key={s.id} title={`${s.label}: ${counts[s.id]}`}
                  style={{ width: `${(counts[s.id] / total) * 100}%`, background: s.color }} />
              ))}
            </div>
          )}
          <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}
              label="All" count={total} />
            {LEAD_STATUSES.map(s => (
              <FilterChip key={s.id} active={statusFilter === s.id}
                onClick={() => setStatusFilter(statusFilter === s.id ? "all" : s.id)}
                label={s.label} count={counts[s.id]} color={s.color} />
            ))}
          </div>
        </div>

        {/* Phones: one view at a time */}
        <div className="lg:hidden grid grid-cols-2 p-1 bg-slate-200/70 rounded-lg mb-3">
          {[["list", "List", List], ["map", "Map", MapIcon]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setMobileView(id)}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium transition-colors ${
                mobileView === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* Map + list */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className={`${mobileView === "map" ? "block" : "hidden"} lg:block lg:col-span-3 h-[calc(100dvh-21rem)] min-h-[340px] lg:h-[620px] bg-white border border-slate-200 rounded-xl overflow-hidden`}>
            <LeadsMap
              leads={filteredLeads}
              selectedId={selectedId}
              onSelect={setSelectedId}
              resetKey={mapResetKey}
              onReset={() => setMapResetKey(k => k + 1)}
            />
          </div>

          <div className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex lg:col-span-2 lg:h-[620px] bg-white border border-slate-200 rounded-xl flex-col overflow-hidden`}>
            {selectedLead && isDesktop ? (
              <LeadDetail
                lead={selectedLead}
                onBack={() => setSelectedId(null)}
                onEdit={() => openEdit(selectedLead)}
                onDelete={() => handleDelete(selectedLead)}
                onUpdateStatus={updateStatus}
              />
            ) : (
              <>
                <div className="p-3 border-b border-slate-200">
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search crew, contact, city, handle"
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                {/* Phones scroll the whole page; desktop scrolls inside the panel */}
                <div className="lg:flex-1 lg:overflow-y-auto">
                  {filteredLeads.length === 0 ? (
                    <div className="text-center py-14 px-6">
                      <p className="text-sm font-medium text-slate-900 mb-1">
                        {total === 0 ? "No leads yet" : "No matching leads"}
                      </p>
                      <p className="text-sm text-slate-500 mb-4">
                        {total === 0 ? "Add the first crew your team is talking to." : "Try a different filter or search term."}
                      </p>
                      {total === 0 && (
                        <button onClick={openCreate} className={btnSecondary}>
                          <Plus className="h-4 w-4" /> Add lead
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {filteredLeads.map(lead => (
                        <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedId(lead.id)} />
                      ))}
                    </ul>
                  )}
                </div>
                {filteredLeads.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-500">
                    {filteredLeads.length} of {total} leads
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Phones: the lead opens as a full-screen sheet */}
      {selectedLead && !isDesktop && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col pt-[env(safe-area-inset-top)]">
          <LeadDetail
            lead={selectedLead}
            onBack={() => setSelectedId(null)}
            onEdit={() => openEdit(selectedLead)}
            onDelete={() => handleDelete(selectedLead)}
            onUpdateStatus={updateStatus}
          />
        </div>
      )}

      {/* Phones: add button within thumb reach */}
      {!sheetOpen && (
        <button onClick={openCreate} aria-label="New lead"
          className="sm:hidden fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 inline-flex items-center gap-2 h-14 pl-5 pr-6 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/25 active:scale-95 transition-transform">
          <Plus className="h-5 w-5" /> New lead
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={closeModal} />
          <form
            onSubmit={handleSubmit}
            className="relative min-w-0 bg-white w-full sm:max-w-xl h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-xl shadow-xl flex flex-col pt-[env(safe-area-inset-top)] sm:pt-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-base font-semibold">{editingLead ? "Edit lead" : "New lead"}</h2>
              <button type="button" onClick={closeModal} aria-label="Close"
                className="p-2 -mr-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
              <FormField label="Crew name" required>
                <input type="text" required autoFocus value={formData.crewName}
                  onChange={setField("crewName")} className={inputClass} placeholder="e.g. Sunday Pickup FC" />
              </FormField>

              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                <FormField label="City">
                  <input type="text" value={formData.city} onChange={setLocationField("city")}
                    className={inputClass} placeholder="e.g. Austin" autoComplete="address-level2" />
                </FormField>
                <FormField label="State">
                  <select value={formData.state} onChange={setLocationField("state")} className={inputClass}>
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Found on">
                <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-lg mb-2">
                  {LEAD_SOURCES.map(s => {
                    const Icon = SOURCE_ICONS[s.id];
                    const active = formData.source === s.id;
                    return (
                      <button key={s.id} type="button"
                        onClick={() => setFormData(f => ({ ...f, source: s.id }))}
                        className={`flex items-center justify-center gap-1.5 h-10 sm:h-8 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                          active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}>
                        <Icon className="h-3.5 w-3.5 hidden min-[400px]:block" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <input type="text" value={formData.handle} onChange={setField("handle")}
                  className={inputClass} placeholder={getLeadSource(formData.source).placeholder}
                  autoCapitalize="none" autoCorrect="off" />
              </FormField>

              <FormField label="Status">
                <StatusPicker value={formData.status}
                  onChange={(status) => setFormData(f => ({ ...f, status }))} />
              </FormField>

              <FormField label="Contact name">
                <input type="text" value={formData.contactName} onChange={setField("contactName")}
                  className={inputClass} placeholder="Who runs the crew" autoComplete="off" />
              </FormField>

              <FormField label="Notes">
                <textarea rows={2} value={formData.notes} onChange={setField("notes")}
                  className={`${inputClass} h-auto py-2 resize-none`} placeholder="Optional" />
              </FormField>

              {/* Everything else, out of the way */}
              <div className="border-t border-slate-200 pt-3">
                <button type="button" onClick={() => setShowMore(v => !v)}
                  className="flex w-full items-center justify-between text-sm font-medium text-slate-700 py-1">
                  More details
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showMore ? "rotate-180" : ""}`} />
                </button>

                {showMore && (
                  <div className="space-y-4 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Phone">
                        <input type="tel" inputMode="tel" value={formData.phone} onChange={setField("phone")}
                          className={inputClass} autoComplete="off" />
                      </FormField>
                      <FormField label="Email">
                        <input type="email" inputMode="email" value={formData.email} onChange={setField("email")}
                          className={inputClass} autoCapitalize="none" autoComplete="off" />
                      </FormField>
                      <FormField label="Crew size">
                        <input type="number" inputMode="numeric" min="0" value={formData.crewSize}
                          onChange={setField("crewSize")} className={inputClass} placeholder="Players" />
                      </FormField>
                      <FormField label="Lead owner">
                        <input type="text" value={formData.owner} onChange={setField("owner")} className={inputClass} />
                      </FormField>
                    </div>
                    <FormField label="Exact location">
                      <div className="flex gap-2 mb-2">
                        <input type="text" value={formData.address} onChange={setLocationField("address")}
                          className={`${inputClass} flex-1`} placeholder="Field or street address" />
                        <button type="button" onClick={handleGeocode} disabled={geocoding} className={btnSecondary}>
                          <Crosshair className="h-4 w-4" />
                          {geocoding ? "Finding…" : "Find"}
                        </button>
                      </div>
                      <div className="h-[240px] rounded-lg border border-slate-200 overflow-hidden">
                        <LocationPicker
                          latitude={formData.latitude}
                          longitude={formData.longitude}
                          onPick={(lat, lng) => setFormData(f => ({ ...f, latitude: lat, longitude: lng }))}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {typeof formData.latitude === "number"
                          ? "Pin placed. Tap the map to move it."
                          : "Tap the map to place the pin, or leave it — we'll use the city."}
                      </p>
                    </FormField>
                  </div>
                )}
              </div>
            </div>

            {/* Footer — pinned to the bottom on mobile */}
            <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 pt-3 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="hidden sm:block text-xs text-slate-400 mr-auto">
                {typeof formData.latitude === "number" ? "Pinned on map" : "Pin is placed from the city on save"}
              </p>
              {!editingLead && (
                <button type="button" disabled={saving}
                  onClick={(e) => handleSubmit(e, { addAnother: true })} className={`${btnSecondary} flex-1 sm:flex-none`}>
                  <span className="sm:hidden">Save + next</span>
                  <span className="hidden sm:inline">Save &amp; add another</span>
                </button>
              )}
              <button type="submit" disabled={saving} className={`${btnPrimary} flex-1 sm:flex-none`}>
                {saving ? "Saving…" : editingLead ? "Save changes" : "Add lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// text-base on mobile keeps iOS from zooming into inputs
const inputClass = "block w-full h-11 sm:h-10 px-3 bg-white border border-slate-300 rounded-lg text-base sm:text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors";
const btnBase = "inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
const btnPrimary = `${btnBase} bg-slate-900 text-white hover:bg-slate-800`;
const btnSecondary = `${btnBase} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm`;

const SOURCE_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
  other: Link2
};

const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
      {label}
      {required && <span className="text-slate-400 font-normal"> *</span>}
    </label>
    {children}
  </div>
);

// Tap-to-pick status, easier on a phone than a native dropdown
const StatusPicker = ({ value, onChange, current }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
    {LEAD_STATUSES.map(s => {
      const active = value === s.id;
      return (
        <button key={s.id} type="button" onClick={() => onChange(s.id)}
          className={`flex items-center gap-2 h-10 sm:h-9 px-2.5 rounded-lg border text-sm text-left transition-colors ${
            active
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
          }`}>
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
          <span className="truncate">{s.label}</span>
          {current === s.id && !active && <span className="ml-auto text-[10px] text-slate-400">now</span>}
        </button>
      );
    })}
  </div>
);

const QuickAction = ({ href, icon: Icon, label }) => (
  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
    className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl bg-slate-100 text-slate-800 text-xs font-medium hover:bg-slate-200 active:bg-slate-200 transition-colors">
    <Icon className="h-5 w-5" />
    {label}
  </a>
);

const MapPlaceholder = () => (
  <div className="h-full w-full flex items-center justify-center bg-slate-100">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-slate-900"></div>
  </div>
);

const Metric = ({ label, short, value, sub, accent }) => (
  <div className="bg-white px-3 py-2.5 sm:p-5 min-w-0">
    <div className="text-[11px] sm:text-sm text-slate-500 truncate">
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
    <div className={`text-lg sm:text-3xl font-semibold tracking-tight sm:mt-1 ${accent ? "text-emerald-700" : "text-slate-900"}`}>
      {value}
    </div>
    {sub && <div className="hidden sm:block text-xs text-slate-500 mt-1 truncate">{sub}</div>}
  </div>
);

const FilterChip = ({ active, onClick, label, count, color }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs sm:text-sm font-medium border transition-colors ${
      active
        ? "bg-slate-900 border-slate-900 text-white"
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
    }`}
  >
    {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
    {label}
    <span className={active ? "text-slate-300" : "text-slate-400"}>{count}</span>
  </button>
);

const StatusBadge = ({ status }) => {
  const s = getLeadStatus(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
};

const HandleLink = ({ lead, className = "" }) => {
  const found = getLeadHandle(lead);
  if (!found) return null;
  const Icon = SOURCE_ICONS[found.source.id];
  const href = found.source.link(found.handle);
  const text = found.source.id === "instagram" && !/^https?:/i.test(found.handle) ? `@${found.handle}` : found.handle;
  const content = (
    <>
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
      <span className="truncate">{text}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 min-w-0 hover:underline ${className}`}>{content}</a>
  ) : (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>{content}</span>
  );
};

const LeadRow = ({ lead, onClick }) => (
  <li>
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{lead.crewName}</div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {[lead.city, lead.state].filter(Boolean).join(", ") || "No location"}
            {typeof lead.latitude !== "number" && <span className="text-slate-400"> · not on map</span>}
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
        {getLeadHandle(lead)
          ? <HandleLink lead={lead} />
          : lead.contactName && <span className="truncate">{lead.contactName}</span>}
        <span className="ml-auto flex-shrink-0 flex items-center gap-2">
          {isStale(lead) && <span className="text-amber-700">Stale</span>}
          <span className="text-slate-400">{timeAgo(lead.lastActivityAt || lead.updatedAt)}</span>
        </span>
      </div>
    </div>
  </li>
);

const LeadDetail = ({ lead, onBack, onEdit, onDelete, onUpdateStatus }) => {
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState(lead.status);

  useEffect(() => {
    setNextStatus(lead.status);
    setNote("");
  }, [lead.id, lead.status]);

  const submitUpdate = async (e) => {
    e.preventDefault();
    await onUpdateStatus(lead, nextStatus, note);
    setNote("");
  };

  const history = [...(lead.history || [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const changed = nextStatus !== lead.status;

  const found = getLeadHandle(lead);
  const handleHref = found?.source.link(found.handle);
  const actions = [
    lead.phone && { href: `tel:${lead.phone}`, icon: Phone, label: "Call" },
    lead.phone && { href: `sms:${lead.phone}`, icon: MessageCircle, label: "Text" },
    lead.email && { href: `mailto:${lead.email}`, icon: Mail, label: "Email" },
    handleHref && { href: handleHref, icon: ExternalLink, label: found.source.label },
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-2 lg:pt-3 pb-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2 lg:mb-3">
          <button onClick={onBack} className="inline-flex items-center gap-1 h-10 text-sm font-medium text-slate-600 hover:text-slate-900 -ml-1 px-1">
            <ArrowLeft className="h-5 w-5 lg:h-4 lg:w-4" /> All leads
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} aria-label="Edit lead"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100">
              <Pencil className="h-4 w-4" /> <span className="lg:hidden">Edit</span>
            </button>
            <button onClick={onDelete} aria-label="Delete lead"
              className="h-10 w-10 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 leading-tight">{lead.crewName}</h2>
          <StatusBadge status={lead.status} />
        </div>
        <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "No location"}</span>
        </div>
        {actions.length > 0 && (
          <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
            {actions.map(a => <QuickAction key={a.label} {...a} />)}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <dl className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-b border-slate-200">
          {getLeadHandle(lead) && (
            <DetailItem label="Found on">
              <HandleLink lead={lead} className="text-slate-900" />
            </DetailItem>
          )}
          <DetailItem label="Contact" icon={User} value={lead.contactName} />
          <DetailItem label="Phone" icon={Phone} value={lead.phone} href={lead.phone && `tel:${lead.phone}`} />
          <DetailItem label="Email" icon={Mail} value={lead.email} href={lead.email && `mailto:${lead.email}`} />
          <DetailItem label="Crew size" icon={Users} value={lead.crewSize ? `${lead.crewSize} players` : null} />
          <DetailItem label="Owner" icon={User} value={lead.owner} />
        </dl>

        {lead.notes && (
          <div className="px-4 py-3 border-b border-slate-200">
            <div className="text-xs font-medium text-slate-500 mb-1">Notes</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}

        {/* Log an update */}
        <form onSubmit={submitUpdate} className="px-4 py-4 border-b border-slate-200 space-y-2">
          <div className="text-xs font-medium text-slate-500">Log an update</div>
          <StatusPicker value={nextStatus} onChange={setNextStatus} current={lead.status} />
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            className={`${inputClass} h-auto py-2 resize-none`} placeholder="What happened? Called, DM'd, met up…" />
          <button type="submit" disabled={!changed && !note.trim()} className={`${btnPrimary} w-full`}>
            {changed ? `Move to ${getLeadStatus(nextStatus).label}` : "Add note"}
          </button>
        </form>

        {/* Activity */}
        <div className="px-4 py-4">
          <div className="text-xs font-medium text-slate-500 mb-3">Activity</div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            <ol className="relative border-l border-slate-200 ml-1 space-y-4">
              {history.map((h, i) => (
                <li key={i} className="pl-4 relative">
                  <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white"
                    style={{ background: getLeadStatus(h.status).color }} />
                  <div className="text-sm text-slate-700">
                    {h.type === "created" && <>Added as <span className="font-medium text-slate-900">{getLeadStatus(h.status).label}</span></>}
                    {h.type === "status" && <>Moved to <span className="font-medium text-slate-900">{getLeadStatus(h.status).label}</span></>}
                    {h.type === "note" && <>Note</>}
                  </div>
                  {h.note && <div className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{h.note}</div>}
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(h.at)} · {h.by}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailItem = ({ label, icon: Icon, value, href, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt>
    <dd className="mt-0.5 flex items-center gap-1.5 min-w-0">
      {children || (value ? (
        <>
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
          {href
            ? <a href={href} className="text-slate-900 hover:underline truncate">{value}</a>
            : <span className="text-slate-900 truncate">{value}</span>}
        </>
      ) : (
        <span className="text-slate-400">—</span>
      ))}
    </dd>
  </div>
);

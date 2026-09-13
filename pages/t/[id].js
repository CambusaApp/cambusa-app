import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  ShoppingBag, Plus, Check, Users, Receipt, Anchor, X, ChevronRight, Ship,
  Pencil, Trash2, Tag, Camera, ImageOff, RotateCcw, ShoppingCart,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { generateTemplate } from "../../lib/templateEngine";

const CATEGORIES = ["Cibo fresco", "Dispensa", "Bevande", "Ghiaccio", "Pulizie", "Cucina", "Altro"];
const QUICK_CATEGORIES = [...CATEGORIES, "Ormeggio", "Carburante", "Pasti a terra"];
const INK = "#1f3a3a";
const PAPER = "#f4f1e6";
const RUST = "#8a5a2b";
const GREEN = "#4b7b5a";

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function simplifyDebts(crew, ledger, settlements) {
  const balance = {};
  crew.forEach((c) => (balance[c.id] = 0));
  ledger.forEach((e) => {
    const payer = crew.find((c) => c.id === e.payer);
    if (!payer) return;
    const participants = e.participants && e.participants.length ? e.participants : crew.map((c) => c.id);
    const share = e.amount / participants.length;
    if (payer.id in balance) balance[payer.id] += e.amount;
    participants.forEach((pid) => {
      if (!(pid in balance)) return;
      balance[pid] -= share;
    });
  });
  settlements.forEach((s) => {
    if (s.from_id in balance) balance[s.from_id] += s.amount;
    if (s.to_id in balance) balance[s.to_id] -= s.amount;
  });
  const creditors = crew.map((c) => ({ id: c.id, name: c.name, amt: balance[c.id] })).filter((c) => c.amt > 0.01).sort((a, b) => b.amt - a.amt);
  const debtors = crew.map((c) => ({ id: c.id, name: c.name, amt: -balance[c.id] })).filter((c) => c.amt > 0.01).sort((a, b) => b.amt - a.amt);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, from: debtors[i].name, to: creditors[j].name, amount: pay });
    debtors[i].amt -= pay; creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return { transfers };
}

async function uploadReceipt(tripId, file) {
  const path = `${tripId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) { alert("Errore caricamento foto: " + error.message); return null; }
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}

function ReceiptPicker({ tripId, receipt, onChange, onView }) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs px-2 py-1.5 rounded flex items-center gap-1 font-num" style={{ border: "1px solid #d6d0bc", background: uploading ? "#eae6d6" : "#fff", cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.7 : 1 }}>
        <Camera size={13} />
        {uploading ? "Caricamento..." : receipt ? "Cambia scontrino" : "Allega scontrino"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async (e) => {
          if (uploading) return;
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          const url = await uploadReceipt(tripId, file);
          setUploading(false);
          if (url) onChange(url);
        }} />
      </label>
      {receipt ? <img src={receipt} alt="scontrino" onClick={() => onView && onView(receipt)} className="w-8 h-8 rounded object-cover cursor-pointer" style={{ border: "1px solid #d6d0bc" }} /> : <ImageOff size={14} opacity={0.3} />}
    </div>
  );
}

export default function TripPage() {
  const router = useRouter();
  const { id: tripId } = router.query;

  const [trip, setTrip] = useState(null);
  const [editingTrip, setEditingTrip] = useState(false);
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [tripDaysDraft, setTripDaysDraft] = useState(1);

  function openTripEdit() {
    setTripNameDraft(trip.name);
    setTripDaysDraft(trip.days);
    setEditingTrip(true);
  }
  async function saveTripEdit() {
    if (!tripNameDraft.trim()) return;
    await supabase.from("trips").update({ name: tripNameDraft.trim(), days: parseInt(tripDaysDraft) || 1 }).eq("id", tripId);
    setEditingTrip(false);
    fetchAll();
  }
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [crew, setCrew] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [quickExpenses, setQuickExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("lista");

  const activeCrew = crew.filter((c) => !c.removed);

  async function fetchAll() {
    if (!tripId) return;
    const [tripRes, crewRes, itemsRes, purchasesRes, quickRes, settleRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase.from("crew").select("*").eq("trip_id", tripId).order("created_at"),
      supabase.from("items").select("*").eq("trip_id", tripId).order("created_at"),
      supabase.from("purchases").select("*").eq("trip_id", tripId),
      supabase.from("quick_expenses").select("*").eq("trip_id", tripId).order("created_at"),
      supabase.from("settlements").select("*").eq("trip_id", tripId),
    ]);
    setTrip(tripRes.data);
    setCrew(crewRes.data || []);
    setItems(itemsRes.data || []);
    setPurchases(purchasesRes.data || []);
    setQuickExpenses(quickRes.data || []);
    setSettlements(settleRes.data || []);
    setLoading(false);
  }

  const debounceRef = useRef(null);
  function scheduleRefetch() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchAll, 300);
  }

  useEffect(() => {
    if (!tripId) return;
    fetchAll();
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crew", filter: `trip_id=eq.${tripId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `trip_id=eq.${tripId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases", filter: `trip_id=eq.${tripId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_expenses", filter: `trip_id=eq.${tripId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `trip_id=eq.${tripId}` }, scheduleRefetch)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // ---- stato UI locale (form) ----
  const [showBought, setShowBought] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [formItemIds, setFormItemIds] = useState([]);
  const [draftBuyerId, setDraftBuyerId] = useState(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftReceipt, setDraftReceipt] = useState(null);
  const [draftParticipants, setDraftParticipants] = useState([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [inlineNewName, setInlineNewName] = useState("");
  const [inlineNewCat, setInlineNewCat] = useState(CATEGORIES[0]);

  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formCat, setFormCat] = useState(CATEGORIES[0]);

  const [qAmount, setQAmount] = useState("");
  const [qCategory, setQCategory] = useState("Varie");
  const [qPayerId, setQPayerId] = useState(null);
  const [qParticipants, setQParticipants] = useState([]);
  const [qNote, setQNote] = useState("");
  const [qReceipt, setQReceipt] = useState(null);
  const [editQuickId, setEditQuickId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const [newCrewName, setNewCrewName] = useState("");
  const [editingCrewId, setEditingCrewId] = useState(null);
  const [editingCrewName, setEditingCrewName] = useState("");

  useEffect(() => {
    if (activeCrew.length && qPayerId === null) setQPayerId(activeCrew[0].id);
    if (activeCrew.length && qParticipants.length === 0) setQParticipants(activeCrew.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew]);

  const ledger = useMemo(() => {
    const fromPurchases = purchases.map((p) => {
      const related = items.filter((i) => i.purchase_id === p.id);
      if (related.length === 0) return null;
      const note = related.length === 1 ? related[0].name : `${related.length} articoli: ${related.slice(0, 2).map((i) => i.name).join(", ")}${related.length > 2 ? ` +${related.length - 2} altri` : ""}`;
      const category = related.length === 1 ? related[0].category : "Spesa raggruppata";
      return { id: `purchase-${p.id}`, amount: Number(p.amount), category, payer: p.buyer_id, participants: p.participants && p.participants.length ? p.participants : crew.map((c) => c.id), note, receipt: p.receipt_url, source: "lista", createdAt: new Date(p.created_at).getTime() };
    }).filter(Boolean);
    const fromQuick = quickExpenses.map((e) => ({ id: e.id, amount: Number(e.amount), category: e.category, payer: e.payer_id, participants: e.participants, note: e.note, receipt: e.receipt_url, source: "aggiungi", createdAt: new Date(e.created_at).getTime() }));
    return [...fromPurchases, ...fromQuick].sort((a, b) => b.createdAt - a.createdAt);
  }, [items, purchases, quickExpenses, crew]);

  const { transfers } = useMemo(() => simplifyDebts(crew, ledger, settlements), [crew, ledger, settlements]);

  const totals = useMemo(() => {
    const preP = ledger.filter((e) => e.source === "lista").reduce((s, e) => s + e.amount, 0);
    const live = ledger.filter((e) => e.source === "aggiungi").reduce((s, e) => s + e.amount, 0);
    const perCategoria = {};
    ledger.forEach((e) => { perCategoria[e.category] = (perCategoria[e.category] || 0) + e.amount; });
    return { preP, live, tot: preP + live, perCategoria };
  }, [ledger]);

  const boughtCount = items.filter((i) => i.bought).length;
  const formItems = items.filter((i) => formItemIds.includes(i.id));

  // ---- equipaggio ----
  async function addCrewMember() {
    if (!newCrewName.trim()) return;
    await supabase.from("crew").insert({ trip_id: tripId, name: newCrewName.trim() });
    setNewCrewName("");
    fetchAll();
  }
  async function removeCrewMember(id) {
    if (activeCrew.length <= 1) return;
    await supabase.from("crew").update({ removed: true }).eq("id", id);
    fetchAll();
  }
  async function restoreCrewMember(id) {
    await supabase.from("crew").update({ removed: false }).eq("id", id);
    fetchAll();
  }
  function startRenameCrew(c) { setEditingCrewId(c.id); setEditingCrewName(c.name); }
  async function saveRenameCrew() {
    if (!editingCrewName.trim()) return;
    await supabase.from("crew").update({ name: editingCrewName.trim() }).eq("id", editingCrewId);
    setEditingCrewId(null);
    fetchAll();
  }

  // ---- selezione / acquisto raggruppato ----
  function toggleSelect(id) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }

  function beginGroupPurchase() {
    setEditingPurchaseId(null);
    setFormItemIds([...selectedIds]);
    setDraftBuyerId(activeCrew[0]?.id ?? null);
    setDraftAmount("");
    setDraftReceipt(null);
    setDraftParticipants(activeCrew.map((c) => c.id));
    setShowItemPicker(false);
    setPurchaseFormOpen(true);
  }
  function openPurchaseEdit(purchaseId) {
    const p = purchases.find((pp) => pp.id === purchaseId);
    if (!p) return;
    const ids = items.filter((i) => i.purchase_id === purchaseId).map((i) => i.id);
    setEditingPurchaseId(purchaseId);
    setFormItemIds(ids);
    setDraftBuyerId(p.buyer_id);
    setDraftAmount(String(p.amount));
    setDraftReceipt(p.receipt_url);
    setDraftParticipants(p.participants && p.participants.length ? p.participants : crew.map((c) => c.id));
    setShowItemPicker(false);
    setPurchaseFormOpen(true);
  }
  function removeFromForm(id) {
    setFormItemIds((prev) => prev.filter((x) => x !== id));
    if (!editingPurchaseId) setSelectedIds((prev) => prev.filter((x) => x !== id));
  }
  function addToForm(id) {
    setFormItemIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (!editingPurchaseId) setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }
  async function createAndAttachItem() {
    if (!inlineNewName.trim()) return;
    const { data } = await supabase.from("items").insert({ trip_id: tripId, category: inlineNewCat, name: inlineNewName.trim(), qty: "" }).select().single();
    if (data) { addToForm(data.id); setItems((prev) => [...prev, data]); }
    setInlineNewName("");
  }
  function cancelPurchaseForm() {
    setPurchaseFormOpen(false); setEditingPurchaseId(null); setFormItemIds([]); setShowItemPicker(false); setInlineNewName("");
  }
  const [savingPurchase, setSavingPurchase] = useState(false);
  async function savePurchase() {
    if (savingPurchase) return;
    if (!draftAmount || formItemIds.length === 0 || draftParticipants.length === 0) return;
    setSavingPurchase(true);
    if (editingPurchaseId) {
      await supabase.from("purchases").update({ amount: parseFloat(draftAmount), buyer_id: draftBuyerId, receipt_url: draftReceipt, participants: draftParticipants }).eq("id", editingPurchaseId);
      const toDetach = items.filter((i) => i.purchase_id === editingPurchaseId && !formItemIds.includes(i.id)).map((i) => i.id);
      const toAttach = formItemIds;
      if (toDetach.length) await supabase.from("items").update({ bought: false, purchase_id: null }).in("id", toDetach);
      if (toAttach.length) await supabase.from("items").update({ bought: true, purchase_id: editingPurchaseId }).in("id", toAttach);
    } else {
      const { data: newPurchase } = await supabase.from("purchases").insert({ trip_id: tripId, amount: parseFloat(draftAmount), buyer_id: draftBuyerId, receipt_url: draftReceipt, participants: draftParticipants }).select().single();
      if (newPurchase) await supabase.from("items").update({ bought: true, purchase_id: newPurchase.id }).in("id", formItemIds);
      setSelectedIds([]);
    }
    cancelPurchaseForm();
    setSavingPurchase(false);
    fetchAll();
  }
  async function deletePurchase(purchaseId) {
    await supabase.from("items").update({ bought: false, purchase_id: null }).eq("purchase_id", purchaseId);
    await supabase.from("purchases").delete().eq("id", purchaseId);
    cancelPurchaseForm();
    fetchAll();
  }
  async function detachItem(item) {
    await supabase.from("items").update({ bought: false, purchase_id: null }).eq("id", item.id);
    fetchAll();
  }

  // ---- voci lista ----
  const [recalcDone, setRecalcDone] = useState(false);
  async function recalcQuantities() {
    const fresh = generateTemplate({
      days: trip.days,
      people: activeCrew.length,
      diet: trip.diet || "onnivoro",
      alcohol: trip.alcohol || "moderazione",
      location: trip.location || "bordo",
    });
    const byName = {};
    fresh.forEach((i) => { byName[i.name.trim().toLowerCase()] = i.qty; });

    const updates = items.filter((i) => !i.bought && byName[i.name.trim().toLowerCase()] && byName[i.name.trim().toLowerCase()] !== i.qty);
    for (const it of updates) {
      await supabase.from("items").update({ qty: byName[it.name.trim().toLowerCase()] }).eq("id", it.id);
    }
    fetchAll();
    setRecalcDone(true);
    setTimeout(() => setRecalcDone(false), 2000);
  }

  function openAddForm() { setEditingItemId(null); setFormName(""); setFormQty(""); setFormCat(CATEGORIES[0]); setShowAddItem(true); }
  function openEditForm(item) { setEditingItemId(item.id); setFormName(item.name); setFormQty(item.qty || ""); setFormCat(item.category); setShowAddItem(true); }
  async function saveItemForm() {
    if (!formName.trim()) return;
    if (editingItemId) {
      await supabase.from("items").update({ name: formName, qty: formQty, category: formCat }).eq("id", editingItemId);
    } else {
      await supabase.from("items").insert({ trip_id: tripId, category: formCat, name: formName, qty: formQty });
    }
    setShowAddItem(false); setEditingItemId(null);
    fetchAll();
  }
  async function deleteItem(id) {
    await supabase.from("items").delete().eq("id", id);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    fetchAll();
  }

  // ---- spese al volo ----
  const [savingQuick, setSavingQuick] = useState(false);
  async function addQuickExpense() {
    if (savingQuick) return;
    if (!qAmount || parseFloat(qAmount) <= 0) return;
    setSavingQuick(true);
    await supabase.from("quick_expenses").insert({ trip_id: tripId, amount: parseFloat(qAmount), category: qCategory, payer_id: qPayerId, participants: qParticipants, note: qNote, receipt_url: qReceipt });
    setQAmount(""); setQNote(""); setQReceipt(null);
    setScreen("spese");
    setSavingQuick(false);
    fetchAll();
  }
  function openQuickEdit(entry) {
    setEditQuickId(entry.id);
    setEditDraft({ amount: String(entry.amount), category: entry.category, payerId: entry.payer, participants: entry.participants, note: entry.note, receipt: entry.receipt });
  }
  async function saveQuickEdit(entry) {
    await supabase.from("quick_expenses").update({ amount: parseFloat(editDraft.amount) || 0, category: editDraft.category, payer_id: editDraft.payerId, participants: editDraft.participants, note: editDraft.note, receipt_url: editDraft.receipt }).eq("id", entry.id);
    setEditQuickId(null);
    fetchAll();
  }
  async function deleteQuickExpense(id) {
    await supabase.from("quick_expenses").delete().eq("id", id);
    setEditQuickId(null);
    fetchAll();
  }

  // ---- saldo ----
  async function markSettled(t) {
    await supabase.from("settlements").insert({ trip_id: tripId, from_id: t.fromId, to_id: t.toId, amount: t.amount });
    fetchAll();
  }
  async function undoSettlement(id) {
    await supabase.from("settlements").delete().eq("id", id);
    fetchAll();
  }

  const [linkCopied, setLinkCopied] = useState(false);
  function copyTripLink() {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-num" style={{ background: PAPER }}>Carico il viaggio...</div>;
  }
  if (!trip) {
    return <div className="min-h-screen flex items-center justify-center font-num" style={{ background: PAPER }}>Viaggio non trovato.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: PAPER, color: "#2c2a22" }}>
      <div className="px-5 pt-6 pb-5" style={{ background: INK, color: PAPER }}>
        <div className="flex items-center gap-2 opacity-80 text-xs font-num tracking-wide mb-1"><Ship size={14} /> VIAGGIO</div>
        {editingTrip ? (
          <div className="flex flex-col gap-2 mt-1 mb-1">
            <input
              autoFocus
              value={tripNameDraft}
              onChange={(e) => setTripNameDraft(e.target.value)}
              className="font-log text-lg px-2 py-1 rounded outline-none"
              style={{ color: "#2c2a22" }}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-num opacity-70">giorni:</span>
              <input
                type="number"
                value={tripDaysDraft}
                onChange={(e) => setTripDaysDraft(e.target.value)}
                className="font-num text-sm px-2 py-1 rounded outline-none w-20"
                style={{ color: "#2c2a22" }}
              />
              <button onClick={saveTripEdit} className="text-xs px-3 py-1.5 rounded-full font-num" style={{ background: PAPER, color: INK }}>Salva</button>
              <button onClick={() => setEditingTrip(false)} className="p-1"><X size={16} /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="font-log text-2xl" style={{ fontWeight: 600 }}>{trip.name} · {trip.days} giorni</h1>
            <button onClick={openTripEdit} className="p-1 opacity-70"><Pencil size={16} /></button>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-sm font-num opacity-90">
          <span>{activeCrew.length} persone a bordo</span><span>·</span><span>{boughtCount}/{items.length} voci comprate</span>
        </div>
      </div>

      {purchaseFormOpen && (
        <div className="px-4 py-3" style={{ background: "#fffdf7", borderBottom: "1px solid #e0dbc8" }}>
          <div className="font-log text-sm mb-2">{editingPurchaseId ? "Modifica acquisto" : "Registra acquisto"}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formItems.map((it) => (
              <span key={it.id} className="text-xs px-2 py-1 rounded-full font-num flex items-center gap-1" style={{ background: "#eae6d6" }}>
                {it.name}<button onClick={() => removeFromForm(it.id)}><X size={11} /></button>
              </span>
            ))}
            {formItems.length === 0 && <span className="text-xs opacity-50">Nessuna voce selezionata.</span>}
          </div>
          <button onClick={() => setShowItemPicker((v) => !v)} className="text-xs font-num underline mb-2" style={{ color: INK }}>+ Aggiungi un'altra voce a questo scontrino</button>
          {showItemPicker && (
            <div className="flex flex-col gap-2 mb-3 p-2 rounded" style={{ background: "#f4f1e6" }}>
              <div className="flex flex-wrap gap-1.5">
                {items.filter((i) => !i.bought && !formItemIds.includes(i.id)).map((it) => (
                  <button key={it.id} onClick={() => addToForm(it.id)} className="text-xs px-2 py-1 rounded-full font-num" style={{ border: "1px solid #d6d0bc", background: "#fff" }}>+ {it.name}</button>
                ))}
              </div>
              <div className="text-xs font-num opacity-60 pt-1" style={{ borderTop: "1px dashed #d6d0bc" }}>Non è ancora in lista? Creala e aggiungila subito:</div>
              <div className="flex gap-2">
                <input value={inlineNewName} onChange={(e) => setInlineNewName(e.target.value)} placeholder="Nome nuova voce..." className="text-sm flex-1 min-w-0 px-2 py-1.5 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} onKeyDown={(e) => e.key === "Enter" && createAndAttachItem()} />
                <button onClick={createAndAttachItem} className="text-xs px-3 rounded font-num" style={{ background: INK, color: PAPER }}>Aggiungi</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => <button key={c} onClick={() => setInlineNewCat(c)} className="text-xs px-2 py-0.5 rounded-full" style={{ background: inlineNewCat === c ? INK : "#fff", color: inlineNewCat === c ? PAPER : "#2c2a22", border: "1px solid #d6d0bc" }}>{c}</button>)}
              </div>
            </div>
          )}
          <div className="text-xs font-num opacity-60 mb-1">Chi ha pagato lo scontrino?</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {crew.filter((c) => !c.removed || c.id === draftBuyerId).map((c) => (
              <button key={c.id} onClick={() => setDraftBuyerId(c.id)} className="text-xs px-2 py-1 rounded-full font-num" style={{ background: draftBuyerId === c.id ? INK : "#f0ede0", color: draftBuyerId === c.id ? PAPER : "#2c2a22" }}>{c.name}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-num text-sm">€</span>
            <input autoFocus type="number" value={draftAmount} onChange={(e) => setDraftAmount(e.target.value)} placeholder="Totale scontrino" className="font-num text-sm flex-1 min-w-0 px-2 py-1.5 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
          </div>
          <div className="mb-2"><ReceiptPicker tripId={tripId} receipt={draftReceipt} onChange={setDraftReceipt} onView={setViewingReceipt} /></div>
          <div className="text-xs font-num opacity-60 mb-1">Tra chi si divide</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {crew.filter((c) => !c.removed || draftParticipants.includes(c.id)).map((c) => {
              const active = draftParticipants.includes(c.id);
              return (
                <button key={c.id} onClick={() => setDraftParticipants((prev) => (active ? prev.filter((id) => id !== c.id) : [...prev, c.id]))} className="text-xs px-2 py-1 rounded-full font-num flex items-center gap-1" style={{ background: active ? RUST : "#f0ede0", color: active ? PAPER : "#2c2a22" }}>
                  {active && <Check size={11} />} {c.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={savePurchase} disabled={savingPurchase} className="flex-1 text-xs py-2 rounded font-num" style={{ background: INK, color: PAPER, opacity: savingPurchase ? 0.6 : 1 }}>{savingPurchase ? "Salvataggio..." : "Salva"}</button>
            {editingPurchaseId && <button onClick={() => deletePurchase(editingPurchaseId)} className="text-xs px-3 py-2 rounded font-num" style={{ border: "1px solid #d6d0bc", color: RUST }}>Elimina</button>}
            <button onClick={cancelPurchaseForm} className="p-2"><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 pt-4 pb-28 overflow-y-auto">
        {screen === "lista" && (
          <div>
            {items.length === 0 && !showAddItem && <div className="text-sm opacity-50 text-center py-8">Lista vuota. Aggiungi la prima voce qui sotto.</div>}
            {items.length > 0 && (
              <button onClick={recalcQuantities} className="w-full text-xs font-num px-3 py-2 rounded mb-2 flex items-center justify-center gap-1" style={{ border: `1px dashed ${recalcDone ? GREEN : "#a39c85"}`, color: recalcDone ? GREEN : "#57503f" }}>
                {recalcDone && <Check size={13} />} {recalcDone ? "Quantità aggiornate" : "Aggiorna quantità in base a giorni/persone attuali"}
              </button>
            )}
            {boughtCount > 0 && (
              <button onClick={() => setShowBought((v) => !v)} className="w-full flex items-center justify-between text-xs font-num px-3 py-2 rounded mb-3" style={{ background: "#eae6d6" }}>
                <span className="flex items-center gap-1"><Check size={13} /> {boughtCount} già comprate</span>
                <span className="opacity-60">{showBought ? "Nascondi" : "Mostra"}</span>
              </button>
            )}
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat && (showBought || !i.bought));
              if (catItems.length === 0) return null;
              return (
                <div key={cat} className="mb-5">
                  <div className="font-log text-sm mb-2 pb-1" style={{ borderBottom: "1px dashed #c9c3ae", color: "#57503f" }}>{cat}</div>
                  <div className="flex flex-col gap-1">
                    {catItems.map((item) => {
                      const purchase = item.bought ? purchases.find((p) => p.id === item.purchase_id) : null;
                      const groupCount = purchase ? items.filter((i) => i.purchase_id === purchase.id).length : 0;
                      const selected = selectedIds.includes(item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded" style={{ background: item.bought ? "#eae6d6" : selected ? "#f7ecd9" : "transparent" }}>
                          <button onClick={() => (item.bought ? detachItem(item) : toggleSelect(item.id))} className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${item.bought ? INK : selected ? RUST : "#a39c85"}`, background: item.bought ? INK : selected ? RUST : "transparent" }}>
                            {(item.bought || selected) && <Check size={14} color={PAPER} />}
                          </button>
                          <div className="flex-1">
                            <div className="text-sm" style={{ textDecoration: item.bought ? "line-through" : "none", opacity: item.bought ? 0.6 : 1 }}>{item.name}</div>
                            {item.qty && <div className="text-xs font-num opacity-50">{item.qty}</div>}
                          </div>
                          {item.bought && purchase && (
                            <div className="flex items-center gap-2">
                              {purchase.receipt_url && <img src={purchase.receipt_url} onClick={() => setViewingReceipt(purchase.receipt_url)} className="w-6 h-6 rounded object-cover cursor-pointer" style={{ border: "1px solid #d6d0bc" }} />}
                              <div className="text-right">
                                <div className="font-num text-sm" style={{ color: RUST }}>€{purchase.amount}</div>
                                <div className="text-xs opacity-50">{crew.find((c) => c.id === purchase.buyer_id)?.name || "Rimosso/a"} · {formatDate(new Date(purchase.created_at).getTime())}{groupCount > 1 ? ` · +${groupCount - 1} altri` : ""}</div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1 opacity-50">
                            {item.bought && <button onClick={() => openEditForm(item)} title="Modifica nome, quantità o categoria" className="p-1"><Tag size={14} /></button>}
                            <button onClick={() => (item.bought ? openPurchaseEdit(item.purchase_id) : openEditForm(item))} title={item.bought ? "Correggi acquisto" : "Modifica voce"} className="p-1"><Pencil size={14} /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {showAddItem ? (
              <div className="p-3 rounded flex flex-col gap-2" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
                <input autoFocus value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome articolo..." className="text-sm px-2 py-2 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
                <input value={formQty} onChange={(e) => setFormQty(e.target.value)} placeholder="Quantità (es. 3 pacchi)" className="text-sm px-2 py-2 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
                <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <button key={c} onClick={() => setFormCat(c)} className="text-xs px-2 py-1 rounded-full" style={{ background: formCat === c ? INK : "#f0ede0", color: formCat === c ? PAPER : "#2c2a22" }}>{c}</button>)}</div>
                <div className="flex gap-2 mt-1">
                  <button onClick={saveItemForm} className="flex-1 text-sm py-2 rounded font-num" style={{ background: INK, color: PAPER }}>{editingItemId ? "Salva modifiche" : "Aggiungi alla lista"}</button>
                  <button onClick={() => setShowAddItem(false)} className="px-3 rounded" style={{ border: "1px solid #d6d0bc" }}><X size={16} /></button>
                </div>
              </div>
            ) : (
              <button onClick={openAddForm} className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-num mt-2" style={{ border: "1.5px dashed #a39c85", color: "#57503f" }}><Plus size={16} /> Aggiungi voce alla lista</button>
            )}
          </div>
        )}

        {screen === "aggiungi" && (
          <div className="flex flex-col gap-4">
            <div className="text-sm opacity-60 font-log">Spesa fatta al volo — un porto, un pranzo a terra, il ghiaccio ricomprato.</div>
            <div>
              <div className="text-xs font-num opacity-60 mb-1">IMPORTO</div>
              <div className="flex items-center gap-2">
                <span className="font-num text-2xl">€</span>
                <input type="number" value={qAmount} onChange={(e) => setQAmount(e.target.value)} placeholder="0.00" className="font-num text-2xl flex-1 min-w-0 px-2 py-1 rounded outline-none bg-transparent" style={{ borderBottom: `2px solid ${INK}` }} />
              </div>
            </div>
            <div>
              <div className="text-xs font-num opacity-60 mb-1">CATEGORIA</div>
              <div className="flex flex-wrap gap-2">{QUICK_CATEGORIES.map((c) => <button key={c} onClick={() => setQCategory(c)} className="text-xs px-2 py-1 rounded-full" style={{ background: qCategory === c ? INK : "#fff", color: qCategory === c ? PAPER : "#2c2a22", border: "1px solid #e0dbc8" }}>{c}</button>)}</div>
            </div>
            <div>
              <div className="text-xs font-num opacity-60 mb-1">CHI HA PAGATO</div>
              <div className="flex flex-wrap gap-2">{activeCrew.map((c) => <button key={c.id} onClick={() => setQPayerId(c.id)} className="text-xs px-3 py-1.5 rounded-full font-num" style={{ background: qPayerId === c.id ? INK : "#fff", color: qPayerId === c.id ? PAPER : "#2c2a22", border: "1px solid #e0dbc8" }}>{c.name}</button>)}</div>
            </div>
            <div>
              <div className="text-xs font-num opacity-60 mb-1">TRA CHI SI DIVIDE</div>
              <div className="flex flex-wrap gap-2">
                {crew.filter((c) => !c.removed || qParticipants.includes(c.id)).map((c) => {
                  const active = qParticipants.includes(c.id);
                  return <button key={c.id} onClick={() => setQParticipants((prev) => (active ? prev.filter((id) => id !== c.id) : [...prev, c.id]))} className="text-xs px-3 py-1.5 rounded-full font-num flex items-center gap-1" style={{ background: active ? RUST : "#fff", color: active ? PAPER : "#2c2a22", border: "1px solid #e0dbc8" }}>{active && <Check size={12} />} {c.name}</button>;
                })}
              </div>
            </div>
            <input value={qNote} onChange={(e) => setQNote(e.target.value)} placeholder="Nota (facoltativa)" className="text-sm px-3 py-2 rounded outline-none" style={{ border: "1px solid #e0dbc8", background: "#fff" }} />
            <ReceiptPicker tripId={tripId} receipt={qReceipt} onChange={setQReceipt} onView={setViewingReceipt} />
            <button onClick={addQuickExpense} disabled={savingQuick} className="py-3 rounded text-sm font-num flex items-center justify-center gap-2" style={{ background: INK, color: PAPER, opacity: savingQuick ? 0.6 : 1 }}><Receipt size={16} /> {savingQuick ? "Salvataggio..." : "Registra spesa"}</button>
          </div>
        )}

        {screen === "spese" && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="font-log text-sm mb-2" style={{ color: "#57503f" }}>Riepilogo</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2 rounded text-center" style={{ background: "#fff", border: "1px solid #e0dbc8" }}><div className="text-[10px] font-num opacity-50">TOTALE</div><div className="font-num text-base">€{totals.tot.toFixed(0)}</div></div>
                <div className="p-2 rounded text-center" style={{ background: "#fff", border: "1px solid #e0dbc8" }}><div className="text-[10px] font-num opacity-50">PRIMA CAMBUSA</div><div className="font-num text-base">€{totals.preP.toFixed(0)}</div></div>
                <div className="p-2 rounded text-center" style={{ background: "#fff", border: "1px solid #e0dbc8" }}><div className="text-[10px] font-num opacity-50">SPESE SUCCESSIVE</div><div className="font-num text-base">€{totals.live.toFixed(0)}</div></div>
              </div>
              <div className="flex flex-col gap-1">
                {Object.entries(totals.perCategoria).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-sm py-1" style={{ borderBottom: "1px dashed #e0dbc8" }}><span className="opacity-70">{cat}</span><span className="font-num">€{amt.toFixed(2)}</span></div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-log text-sm mb-2" style={{ color: "#57503f" }}>Registro spese ({ledger.length})</div>
              {ledger.length === 0 ? <div className="text-sm opacity-50 text-center py-4">Ancora nessuna spesa registrata.</div> : (
                <div className="flex flex-col gap-2">
                  {ledger.map((e) => (
                    <div key={e.id}>
                      <div className="flex items-center gap-3 p-2.5 rounded" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
                        {e.receipt ? <img src={e.receipt} onClick={() => setViewingReceipt(e.receipt)} className="w-9 h-9 rounded object-cover shrink-0 cursor-pointer" style={{ border: "1px solid #d6d0bc" }} /> : <div className="w-9 h-9 rounded flex items-center justify-center shrink-0" style={{ background: "#f0ede0" }}><Receipt size={14} opacity={0.4} /></div>}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{e.note || e.category}</div>
                          <div className="text-xs font-num opacity-50">{e.category} · {crew.find((c) => c.id === e.payer)?.name || "Rimosso/a"} · {formatDate(e.createdAt)}</div>
                        </div>
                        <div className="font-num text-sm" style={{ color: RUST }}>€{e.amount.toFixed(2)}</div>
                        <button onClick={() => (e.source === "lista" ? openPurchaseEdit(e.id.replace("purchase-", "")) : openQuickEdit(e))} className="p-1 opacity-50"><Pencil size={14} /></button>
                      </div>

                      {e.source === "aggiungi" && editQuickId === e.id && (
                        <div className="mt-1 p-3 rounded flex flex-col gap-2" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
                          <div className="flex items-center gap-2">
                            <span className="font-num text-sm">€</span>
                            <input type="number" value={editDraft.amount} onChange={(e2) => setEditDraft((d) => ({ ...d, amount: e2.target.value }))} className="font-num text-sm flex-1 min-w-0 px-2 py-1 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
                          </div>
                          <div className="flex flex-wrap gap-2">{QUICK_CATEGORIES.map((c) => <button key={c} onClick={() => setEditDraft((d) => ({ ...d, category: c }))} className="text-xs px-2 py-1 rounded-full" style={{ background: editDraft.category === c ? INK : "#f0ede0", color: editDraft.category === c ? PAPER : "#2c2a22" }}>{c}</button>)}</div>
                          <div className="text-xs font-num opacity-60">Chi ha pagato</div>
                          <div className="flex flex-wrap gap-2">{crew.filter((c) => !c.removed || c.id === editDraft.payerId).map((c) => <button key={c.id} onClick={() => setEditDraft((d) => ({ ...d, payerId: c.id }))} className="text-xs px-2 py-1 rounded-full font-num" style={{ background: editDraft.payerId === c.id ? INK : "#f0ede0", color: editDraft.payerId === c.id ? PAPER : "#2c2a22" }}>{c.name}</button>)}</div>
                          <div className="text-xs font-num opacity-60">Tra chi si divide</div>
                          <div className="flex flex-wrap gap-2">
                            {crew.filter((c) => !c.removed || (editDraft.participants || []).includes(c.id)).map((c) => {
                              const active = (editDraft.participants || []).includes(c.id);
                              return <button key={c.id} onClick={() => setEditDraft((d) => ({ ...d, participants: active ? d.participants.filter((id) => id !== c.id) : [...(d.participants || []), c.id] }))} className="text-xs px-2 py-1 rounded-full font-num flex items-center gap-1" style={{ background: active ? RUST : "#f0ede0", color: active ? PAPER : "#2c2a22" }}>{active && <Check size={11} />} {c.name}</button>;
                            })}
                          </div>
                          <input value={editDraft.note || ""} onChange={(e2) => setEditDraft((d) => ({ ...d, note: e2.target.value }))} placeholder="Nota" className="text-sm px-2 py-1.5 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
                          <ReceiptPicker tripId={tripId} receipt={editDraft.receipt} onChange={(r) => setEditDraft((d) => ({ ...d, receipt: r }))} onView={setViewingReceipt} />
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => saveQuickEdit(e)} className="text-xs px-3 py-1.5 rounded font-num flex-1" style={{ background: INK, color: PAPER }}>Salva modifiche</button>
                            <button onClick={() => deleteQuickExpense(e.id)} className="text-xs px-3 py-1.5 rounded font-num" style={{ border: "1px solid #d6d0bc", color: RUST }}>Elimina</button>
                            <button onClick={() => setEditQuickId(null)} className="p-1.5"><X size={16} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="font-log text-sm mb-2" style={{ color: "#57503f" }}>Saldo — chi deve dare a chi</div>
              {transfers.length === 0 ? <div className="text-sm opacity-50 py-4 text-center">Tutti in pari, per ora.</div> : (
                <div className="flex flex-col gap-2">
                  {transfers.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
                      <div className="text-sm flex items-center gap-2"><span>{t.from}</span><ChevronRight size={14} opacity={0.4} /><span>{t.to}</span></div>
                      <div className="flex items-center gap-3">
                        <span className="font-num text-sm" style={{ color: RUST }}>€{t.amount.toFixed(2)}</span>
                        <button onClick={() => markSettled(t)} className="text-xs px-2 py-1 rounded-full font-num" style={{ background: "#eae6d6" }}>Segna saldato</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {settlements.length > 0 && (
              <div>
                <div className="font-log text-sm mb-2" style={{ color: "#57503f" }}>Saldati</div>
                <div className="flex flex-col gap-2">
                  {settlements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded" style={{ background: "#f0f4f0", border: "1px solid #d7e2d9" }}>
                      <div className="text-sm flex items-center gap-2 opacity-70">
                        <Check size={14} color={GREEN} /><span>{crew.find((c) => c.id === s.from_id)?.name || "Rimosso/a"}</span><ChevronRight size={14} opacity={0.4} /><span>{crew.find((c) => c.id === s.to_id)?.name || "Rimosso/a"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-num text-sm" style={{ color: GREEN }}>€{Number(s.amount).toFixed(2)}</span>
                        <button onClick={() => undoSettlement(s.id)} className="text-xs px-2 py-1 rounded-full font-num flex items-center gap-1" style={{ background: "#fff" }}><RotateCcw size={12} /> Annulla</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "equipaggio" && (
          <div className="flex flex-col gap-3">
            <div className="text-sm opacity-60 font-log mb-1">Chiunque con questo link può unirsi in qualsiasi momento, anche a metà viaggio.</div>
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
              <span className="text-xs font-num flex-1 min-w-0 truncate opacity-60">{typeof window !== "undefined" ? window.location.href : ""}</span>
              <button onClick={copyTripLink} className="text-xs px-3 py-1.5 rounded-full font-num flex items-center gap-1" style={{ background: linkCopied ? GREEN : INK, color: PAPER }}>{linkCopied && <Check size={13} />} {linkCopied ? "Copiato!" : "Copia link"}</button>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {activeCrew.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-log text-sm shrink-0" style={{ background: "#eae6d6" }}>{c.name[0]}</div>
                  {editingCrewId === c.id ? (
                    <input autoFocus value={editingCrewName} onChange={(e) => setEditingCrewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRenameCrew()} className="text-sm flex-1 min-w-0 px-2 py-1 rounded outline-none" style={{ border: "1px solid #d6d0bc" }} />
                  ) : (
                    <span className="text-sm flex-1">{c.name}</span>
                  )}
                  <span className="font-num text-xs px-2 py-0.5 rounded-full" style={{ background: "#e7e2d3", color: "#57503f" }}>a bordo</span>
                  {editingCrewId === c.id ? (
                    <button onClick={saveRenameCrew} className="p-1"><Check size={14} /></button>
                  ) : (
                    <button onClick={() => startRenameCrew(c)} className="p-1 opacity-40"><Pencil size={14} /></button>
                  )}
                  {activeCrew.length > 1 && <button onClick={() => removeCrewMember(c.id)} className="p-1 opacity-40"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="text-xs opacity-50 -mt-1">Rimuovere qualcuno non tocca le spese già registrate — semplicemente non verrà più conteggiato nelle divisioni future.</div>

            {crew.some((c) => c.removed) && (
              <div className="mt-2">
                <div className="font-log text-sm mb-2" style={{ color: "#57503f" }}>Rimossi</div>
                <div className="flex flex-col gap-1">
                  {crew.filter((c) => c.removed).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded" style={{ background: "#f4f1e6", border: "1px solid #e0dbc8" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-log text-sm opacity-50" style={{ background: "#eae6d6" }}>{c.name[0]}</div>
                      <span className="text-sm flex-1 opacity-50">{c.name}</span>
                      <button onClick={() => restoreCrewMember(c.id)} className="text-xs px-3 py-1.5 rounded-full font-num flex items-center gap-1" style={{ background: "#fff", border: "1px solid #d6d0bc" }}><RotateCcw size={12} /> Reinserisci</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 p-2 rounded" style={{ border: "1px dashed #a39c85" }}>
              <input value={newCrewName} onChange={(e) => setNewCrewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCrewMember()} placeholder="Nome nuova persona..." className="text-sm flex-1 min-w-0 px-2 py-1.5 rounded outline-none bg-transparent" />
              <button onClick={addCrewMember} className="text-xs px-3 py-1.5 rounded-full font-num" style={{ background: INK, color: PAPER }}>Aggiungi</button>
            </div>
          </div>
        )}
      </div>

      {screen === "lista" && selectedIds.length > 0 && !purchaseFormOpen && (
        <div className="fixed left-0 right-0 flex items-center justify-between px-4 py-3" style={{ bottom: 64, background: INK, color: PAPER }}>
          <div className="flex items-center gap-2 text-sm font-num"><ShoppingCart size={16} /> {selectedIds.length} selezionate</div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedIds([])} className="text-xs opacity-70">Annulla</button>
            <button onClick={beginGroupPurchase} className="text-xs px-3 py-1.5 rounded-full font-num" style={{ background: PAPER, color: INK }}>Registra acquisto →</button>
          </div>
        </div>
      )}

      {viewingReceipt && (
        <div
          onClick={() => setViewingReceipt(null)}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(20, 24, 22, 0.92)" }}
        >
          <button onClick={() => setViewingReceipt(null)} className="absolute top-5 right-5 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
            <X size={22} color="#fff" />
          </button>
          <img src={viewingReceipt} alt="scontrino a schermo intero" className="max-w-[92%] max-h-[85%] object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 flex justify-around py-2 px-2" style={{ background: "#fff", borderTop: "1px solid #e0dbc8" }}>
        {[
          { id: "lista", label: "Lista", icon: ShoppingBag },
          { id: "aggiungi", label: "Aggiungi", icon: Plus },
          { id: "spese", label: "Spese", icon: Anchor },
          { id: "equipaggio", label: "Equipaggio", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          return (
            <button key={tab.id} onClick={() => setScreen(tab.id)} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded">
              <Icon size={20} color={active ? INK : "#a39c85"} />
              <span className="text-xs font-num" style={{ color: active ? INK : "#a39c85" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

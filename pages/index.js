import { useState } from "react";
import { useRouter } from "next/router";
import { Ship, X, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateTemplate } from "../lib/templateEngine";

const INK = "#1f3a3a";
const PAPER = "#f4f1e6";
const RUST = "#8a5a2b";

function ToggleRow({ label, options, value, onChange }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-num opacity-60 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="text-xs px-3 py-1.5 rounded-full font-num flex items-center gap-1"
            style={{
              background: value === opt.value ? RUST : "#fff",
              color: value === opt.value ? PAPER : "#2c2a22",
              border: "1px solid #e0dbc8",
            }}
          >
            {value === opt.value && <Check size={11} />} {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [tripName, setTripName] = useState("Il mio viaggio");
  const [tripDays, setTripDays] = useState(5);
  const [crewNames, setCrewNames] = useState(["Io"]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const [diet, setDiet] = useState("onnivoro");
  const [alcohol, setAlcohol] = useState("moderazione");
  const [location, setLocation] = useState("bordo");

  function addName() {
    if (!newName.trim()) return;
    setCrewNames((prev) => [...prev, newName.trim()]);
    setNewName("");
  }
  function removeName(idx) {
    if (crewNames.length <= 1) return;
    setCrewNames((prev) => prev.filter((_, i) => i !== idx));
  }

  async function startTrip(useTemplate) {
    setLoading(true);
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .insert({ name: tripName, days: tripDays })
      .select()
      .single();
    if (tripErr) {
      alert("Errore nella creazione del viaggio: " + tripErr.message);
      setLoading(false);
      return;
    }

    const crewRows = crewNames.map((name) => ({ trip_id: trip.id, name }));
    const { data: crew, error: crewErr } = await supabase.from("crew").insert(crewRows).select();
    if (crewErr) {
      alert("Errore nella creazione dell'equipaggio: " + crewErr.message);
      setLoading(false);
      return;
    }

    if (useTemplate) {
      const items = generateTemplate({ days: tripDays, people: crew.length, diet, alcohol, location }).map((i) => ({ ...i, trip_id: trip.id }));
      await supabase.from("items").insert(items);
    }

    router.push(`/t/${trip.id}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: PAPER, color: "#2c2a22" }}>
      <Ship size={28} color={INK} className="mb-2" />
      <h1 className="font-log text-2xl mb-6" style={{ color: INK }}>
        Cambusa — nuovo viaggio
      </h1>
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <div className="text-xs font-num opacity-60 mb-1">NOME VIAGGIO</div>
          <input value={tripName} onChange={(e) => setTripName(e.target.value)} className="w-full px-3 py-2 rounded text-sm outline-none" style={{ border: "1px solid #d6d0bc", background: "#fff" }} />
        </div>
        <div>
          <div className="text-xs font-num opacity-60 mb-1">GIORNI DI VIAGGIO</div>
          <input type="number" value={tripDays} onChange={(e) => setTripDays(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded text-sm outline-none" style={{ border: "1px solid #d6d0bc", background: "#fff" }} />
        </div>
        <div>
          <div className="text-xs font-num opacity-60 mb-1">EQUIPAGGIO INIZIALE ({crewNames.length})</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {crewNames.map((n, idx) => (
              <span key={idx} className="text-xs px-2 py-1 rounded-full font-num flex items-center gap-1" style={{ background: "#eae6d6" }}>
                {n}
                {crewNames.length > 1 && (
                  <button onClick={() => removeName(idx)}>
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addName()}
              placeholder="Nome persona..."
              className="text-sm flex-1 min-w-0 px-2 py-1.5 rounded outline-none"
              style={{ border: "1px solid #d6d0bc", background: "#fff" }}
            />
            <button onClick={addName} className="text-xs px-3 rounded font-num" style={{ background: INK, color: PAPER }}>
              Aggiungi
            </button>
          </div>
          <div className="text-xs opacity-50 mt-1">Altri potranno unirsi in seguito con il link del viaggio.</div>
        </div>
        {showTemplateOptions && (
          <div className="p-3 rounded" style={{ background: "#fff", border: "1px solid #e0dbc8" }}>
            <ToggleRow
              label="REGIME ALIMENTARE"
              value={diet}
              onChange={setDiet}
              options={[
                { value: "onnivoro", label: "Onnivoro" },
                { value: "vegano", label: "Vegano" },
              ]}
            />
            <ToggleRow
              label="QUANTO BERE"
              value={alcohol}
              onChange={setAlcohol}
              options={[
                { value: "moderazione", label: "Con moderazione" },
                { value: "gusto", label: "Con gusto" },
              ]}
            />
            <ToggleRow
              label="DOVE SI MANGIA DI SOLITO"
              value={location}
              onChange={setLocation}
              options={[
                { value: "bordo", label: "Quasi sempre a bordo" },
                { value: "misto", label: "Un po' di entrambi" },
                { value: "terra", label: "Spesso a terra" },
              ]}
            />
            <button disabled={loading} onClick={() => startTrip(true)} className="w-full py-3 rounded text-sm font-num mt-1" style={{ background: INK, color: PAPER, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Creazione..." : "Crea la lista suggerita"}
            </button>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {!showTemplateOptions && (
            <button disabled={loading} onClick={() => setShowTemplateOptions(true)} className="py-3 rounded text-sm font-num" style={{ background: INK, color: PAPER, opacity: loading ? 0.6 : 1 }}>
              Usa un modello suggerito
            </button>
          )}
          <button disabled={loading} onClick={() => startTrip(false)} className="py-3 rounded text-sm font-num" style={{ border: `1.5px solid ${INK}`, color: INK, opacity: loading ? 0.6 : 1 }}>
            Parti da una lista vuota
          </button>
        </div>
      </div>
    </div>
  );
}

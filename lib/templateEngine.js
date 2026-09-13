// Motore delle quantità suggerite per il modello di cambusa.
// Ogni funzione ritorna un array di { category, name, qty }.

function round(n) {
  return Math.max(1, Math.ceil(n - 1e-9));
}

// Fattore "quanto si mangia a bordo": riduce le quantità di cibo/bevande
// (non tocca pulizie, cucina, ghiaccio) in base a quanto l'equipaggio prevede di mangiare a terra.
const LOCATION_FACTORS = {
  bordo: 1,
  misto: 0.75,
  terra: 0.5,
};

// Fattore "quanto si beve": moltiplica solo vino e birra.
const ALCOHOL_FACTORS = {
  moderazione: 1,
  gusto: 2.5,
};

export function generateTemplate({ days, people, diet = "onnivoro", alcohol = "moderazione", location = "bordo" }) {
  const d = Math.max(1, days);
  const p = Math.max(1, people);
  const locF = LOCATION_FACTORS[location] ?? 1;
  const alcF = ALCOHOL_FACTORS[alcohol] ?? 1;

  const items = [];
  const add = (category, name, qty) => items.push({ category, name, qty });

  // ---------------- PULIZIE (quantità fisse) ----------------
  add("Pulizie", "Sacchetti spazzatura", `${round(p / 4)} rotolo/i`);
  add("Pulizie", "Scottex", `${round((d / 7) * 2)} rotoli`);
  add("Pulizie", "Carta igienica", `${round((p / 2) * (d / 7))} rotoli`);
  add("Pulizie", "Mollette stendipanni", "1 confezione");
  add("Pulizie", "Lavapiatti", `${round(p / 6)} flacone/i`);
  add("Pulizie", "Sgrassatore", `${round(p / 6)} flacone/i`);
  add("Pulizie", "Spugnette pulizia", "1 confezione");
  add("Pulizie", "Stracci", "1 confezione");
  add("Pulizie", "Detersivo bucato", `${round(d / 7)} confezione/i`);

  // ---------------- CUCINA ----------------
  add("Cucina", "Tovaglioli", `${round(p / 4)} confezione/i`);
  add("Cucina", "Piatti di carta", `${round(p * d)} pz`);
  add("Cucina", "Bicchieri di carta", `${round(p * d * 2)} pz`);
  add("Cucina", "Posate usa e getta", `${round(p * d)} set`);
  add("Cucina", "Aceto balsamico", "1 bottiglia");
  add("Cucina", "Bombola gas", "1 pz");

  // ---------------- BASE UNIVERSALE (persona/giorno, risente "a terra") ----------------
  const eff = p * d * locF; // "giorni-persona effettivi" da sfamare
  add("Bevande", "Acqua naturale", `${round(eff * 1.0 / 1.5)} bottiglie da 1,5L`);
  add("Bevande", "Acqua frizzante", `${round(eff * 1.0 / 1.5)} bottiglie da 1,5L`);
  add("Cibo fresco", "Pane", `${round(eff * 100 / 500)} pagnotte`);
  add("Dispensa", "Fette biscottate", `${round(eff * 30 / 300)} confezioni`);
  add("Dispensa", "Biscotti", `${round(eff * 30 / 300)} confezioni`);
  add("Dispensa", "Marmellata", `${round(eff * 15 / 350)} vasetti`);
  add("Dispensa", "Caffè", `${round(eff * 1 / 18)} confezioni`);
  add("Dispensa", "Tè / tisane", `${round(eff * 0.5 / 20)} scatole`);
  add("Dispensa", "Zucchero", `${round(eff * 15 / 1000)} confezioni`);
  add("Dispensa", "Pasta", `${round(eff * 100 / 500)} pacchi`);
  add("Dispensa", "Riso", `${round(eff * 40 / 500)} pacchi`);
  add("Dispensa", "Passata di pomodoro", `${round(eff * 50 / 700)} bottiglie`);
  add("Dispensa", "Fagioli in scatola", `${round(eff * 0.3)} scatole`);
  add("Dispensa", "Olio d'oliva", `${round(eff * 15 / 1000)} bottiglie`);
  add("Dispensa", "Sale", "1 confezione");

  // ---------------- DEPERIBILE (tetto 2-3 giorni, risente "a terra") ----------------
  const cappedFruit = p * Math.min(d, 3) * locF;
  const cappedVeg = p * Math.min(d, 2) * locF;
  add("Cibo fresco", "Frutta fresca", `${round(cappedFruit * 2)} pz`);
  add("Cibo fresco", "Verdura fresca", `${round(cappedVeg * 150 / 1000)} kg`);
  add("Cibo fresco", "Insalata", `${round(cappedVeg * 50 / 200)} buste`);

  // ---------------- ONNIVORO / VEGANO ----------------
  if (diet === "vegano") {
    add("Cibo fresco", "Latte vegetale", `${round(eff * 0.15 / 1)} litri`);
    add("Cibo fresco", "Tofu", `${round(eff * 40 / 200)} confezioni`);
    add("Cibo fresco", "Hamburger / macinato vegetale", `${round(eff * 0.3)} pz`);
    add("Dispensa", "Legumi misti extra", `${round(eff * 30 / 400)} confezioni`);
    add("Cibo fresco", "Yogurt vegetale", `${round(eff * 0.4)} pz`);
  } else {
    add("Cibo fresco", "Latte", `${round(eff * 0.15 / 1)} litri`);
    add("Cibo fresco", "Uova", `${round(eff * 0.3)} pz`);
    add("Cibo fresco", "Prosciutto e formaggi", `${round(eff * 40 / 1000)} kg`);
    add("Dispensa", "Tonno in scatola", `${round(eff * 0.2)} scatole`);
    add("Cibo fresco", "Würstel / carne in scatola", `${round(eff * 0.2)} confezioni`);
    add("Cibo fresco", "Yogurt", `${round(eff * 0.4)} pz`);
  }

  // ---------------- BEVANDE ALCOLICHE E ANALCOLICHE ----------------
  add("Bevande", "Vino", `${round(eff * 0.15 * alcF / 0.75)} bottiglie`);
  add("Bevande", "Birra", `${round(eff * 0.2 * alcF / 0.33)} bottiglie/lattine`);
  add("Bevande", "Succhi di frutta", `${round(eff * 0.15 / 1)} litri`);
  add("Bevande", "Bibite gassate", `${round(eff * 0.15 / 1.5)} bottiglie`);

  // ---------------- GHIACCIO (non risente del toggle "a terra") ----------------
  add("Ghiaccio", "Ghiaccio", `${round(p * d * 0.3)} kg`);

  return items;
}

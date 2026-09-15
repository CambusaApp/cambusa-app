import Head from "next/head";
import Link from "next/link";

const INK = "#1f3a3a";
const PAPER = "#f4f1e6";

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Cambusa — Privacy</title>
      </Head>
      <div className="min-h-screen px-6 py-10" style={{ background: PAPER, color: "#2c2a22" }}>
        <div className="max-w-xl mx-auto">
          <h1 className="font-log text-2xl mb-1" style={{ color: INK, fontWeight: 600 }}>Privacy — in breve</h1>
          <p className="text-sm opacity-60 mb-6">Cosa salviamo, dove, e perché. Scritto in italiano semplice, non in legalese.</p>

          <div className="flex flex-col gap-5 text-sm leading-relaxed">
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Cosa salviamo</h2>
              <p>Il nome del viaggio, i giorni, i nomi delle persone dell'equipaggio (quelli che scrivete voi, non email né numeri di telefono), la lista della spesa, le spese registrate e le eventuali foto degli scontrini che allegate.</p>
            </div>
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Dove</h2>
              <p>Su Supabase, un servizio di database con sede in Unione Europea. Le foto degli scontrini sono salvate nello stesso posto.</p>
            </div>
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Nessun account, nessuna password</h2>
              <p>Cambusa non chiede email né password. L'accesso a un viaggio avviene tramite un link univoco: chi ha il link può vedere e modificare quel viaggio. Non condividete il link fuori dal vostro equipaggio.</p>
            </div>
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Cosa NON facciamo</h2>
              <p>Non vendiamo né condividiamo i vostri dati con terzi. Non ci sono pubblicità né tracciamento pubblicitario dentro l'app.</p>
            </div>
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Il modulo "Hai suggerimenti?"</h2>
              <p>Se scrivete un messaggio di feedback, viene salvato insieme al nome e contatto che scegliete voi di fornire (entrambi facoltativi) e ci viene inviato via email per poterlo leggere.</p>
            </div>
            <div>
              <h2 className="font-log text-base mb-1" style={{ color: INK }}>Cancellazione dei dati</h2>
              <p>Se volete che un vostro viaggio venga cancellato definitivamente, scrivetecelo tramite il modulo "Hai suggerimenti?" nella scheda Equipaggio, indicando il nome del viaggio: lo rimuoviamo su richiesta.</p>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/" className="text-sm font-num underline" style={{ color: INK }}>← Torna a Cambusa</Link>
          </div>
        </div>
      </div>
    </>
  );
}

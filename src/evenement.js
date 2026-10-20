// Signaler un événement au journal du serveur — template/evenements/README.md du dépôt Infra.
// Ne bloque jamais, ne lève jamais : sans EVENTS_URL (poste de développement), ne fait rien.
// Jamais de donnée personnelle ici (ni adresse, ni nom) : un identifiant technique suffit.

const NIVEAUX = ['info', 'warning', 'error', 'critical'];

export async function evenement(level, message, fields = {}) {
  const url = process.env.EVENTS_URL;
  if (!url || !NIVEAUX.includes(level)) return false;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message: String(message).slice(0, 2000), fields }),
      signal: AbortSignal.timeout(2000),
    });
    return r.status === 202;
  } catch {
    return false; // le journal ne doit jamais faire tomber l'application
  }
}

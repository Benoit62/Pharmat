// Phrases d'accueil et d'encouragement, reprises de Pharmat 1 : resserrées, sans doublons,
// et formulées pour tout le monde (plus de « prêt(e) »).
const accueils = [
  'Bonjour {nom}, on s’y remet ?',
  'Salut {nom}, une petite série ?',
  'Content de te revoir, {nom}.',
  'Bonjour {nom}, quelques questions avant de souffler ?',
  'Salut {nom}, de nouvelles questions t’attendent.',
  'Te revoilà, {nom}. On continue sur ta lancée ?',
];

const encouragements = [
  'Chaque heure de préparation te rapproche de ton objectif. Avance à ton rythme, mais avance.',
  'Les erreurs d’aujourd’hui sont les points gagnés le jour du concours : prends chaque correction comme une leçon.',
  'Même les médicaments ont besoin de temps pour agir. Ta réussite aussi, mais elle sera efficace.',
  'Chaque chapitre révisé est une brique de plus. Pas à pas, l’édifice tient debout.',
  'Une pause n’a aucune contre-indication. Reviens ensuite avec les idées claires.',
  'Derrière chaque pharmacien, il y a des tonnes de fiches et quelques cafés. Tu es en bonne compagnie.',
  'Les moments de doute passent ; la fierté d’avoir tenu reste.',
  'Réviser, c’est comme une posologie : régulière plutôt que massive.',
  'Les molécules les plus complexes ont toutes été des énigmes un jour. Tu es en train de les résoudre.',
  'Dix questions bien corrigées valent mieux que cinquante survolées.',
  'Visualise le jour du concours : chaque série d’aujourd’hui y répond déjà un peu.',
  'Ce qui coince aujourd’hui sera évident dans trois révisions. Note-le et continue.',
];

const tirer = (liste) => liste[Math.floor(Math.random() * liste.length)];

export const phraseAccueil = (nom) => tirer(accueils).replaceAll('{nom}', nom);
export const phraseEncouragement = () => tirer(encouragements);

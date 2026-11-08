import type { LanguageCode } from "@/lib/i18n";

/** Finite reader-interface vocabulary; never translates arbitrary source prose. */
const FRENCH = {
  "Start here": "Commencer ici",
  "Bibliography in preparation.": "Bibliographie en préparation.",
  "Books": "Livres", "Papers": "Articles scientifiques", "Videos": "Vidéos", "Articles": "Articles",
  "PDFs": "PDF", "Podcasts": "Podcasts", "Tools": "Outils",
  "Reading": "Lecture",
  "Close source and return to topic": "Fermer la source et revenir au sujet",
  "Source content": "Contenu de la source", "Loading source": "Chargement de la source",
  "This source could not be loaded.": "Cette source n’a pas pu être chargée.",
  "Try again": "Réessayer", "This source is no longer available.": "Cette source n’est plus disponible.",
  "Previous source": "Source précédente", "Next source": "Source suivante",
  "Finished": "Terminé", "Mark as finished": "Marquer comme terminé",
  "Open original source ↗": "Ouvrir la source originale ↗",
  "This could not be shown inside Curiosity, Sourced. You can still read it at the source.": "Ce contenu ne peut pas être affiché dans Curiosity, Sourced. Il reste accessible à la source.",
  "Player unavailable? Show original link": "Lecteur indisponible ? Afficher le lien original",
  "Video": "Vidéo", "Play video": "Lire la vidéo", "Preview": "Aperçu", "Original page": "Page originale",
  "This PDF could not be read inside Curiosity, Sourced. It may be unavailable or the publisher may block in-app access. Open the original source below.": "Ce PDF ne peut pas être lu dans Curiosity, Sourced. Il est peut-être indisponible ou son éditeur bloque la lecture intégrée. Ouvrez la source originale ci-dessous.",
  "Loading PDF reader…": "Chargement du lecteur PDF…", "Read original PDF here": "Lire le PDF original ici",
  "The original hosted PDF opens here using your browser. Some mobile browsers or publishers cannot display it inside the app.": "Le PDF original s’ouvre ici dans votre navigateur. Certains navigateurs mobiles ou éditeurs empêchent son affichage dans l’application.",
  "The provider controls this preview and its availability. It may offer only a sample.": "Le fournisseur contrôle cet aperçu et sa disponibilité. Il peut ne proposer qu’un extrait.",
  "Blank or blocked? Show original link": "Aperçu vide ou bloqué ? Afficher le lien original",
  "Open provider preview": "Ouvrir l’aperçu du fournisseur", "Loading text": "Chargement du texte",
  "Loading the original page…": "Chargement de la page originale…",
  "Page blank or blocked? Show source link": "Page vide ou bloquée ? Afficher le lien de la source",
  "PDF controls": "Commandes du PDF", "Previous page": "Page précédente", "Next page": "Page suivante",
  "Zoom out": "Réduire le zoom", "Zoom in": "Augmenter le zoom", "Page": "Page",
  "★ Bookmarked": "★ Page enregistrée", "☆ Bookmark": "☆ Enregistrer la page",
  "Search in this PDF": "Rechercher dans ce PDF", "Search": "Rechercher", "Find": "Trouver",
  "No text match (scanned PDFs may have no searchable text).": "Aucun résultat (les PDF numérisés peuvent ne pas contenir de texte consultable).",
  "Rendering PDF page…": "Affichage de la page PDF…", "Loading PDF…": "Chargement du PDF…",
  "PDF page": "Page PDF", "of": "sur", "Open the library": "Ouvrir la bibliothèque", "Back to the feed": "Retour au fil",
  "Remove from saved topics": "Retirer des sujets enregistrés", "Save topic for later": "Enregistrer le sujet pour plus tard",
  "Define": "Définir", "Explain simply": "Expliquer simplement", "Why it matters": "Pourquoi c’est important",
  "Related Curiosity, Sourced topics": "Sujets liés de Curiosity, Sourced", "Search sources": "Rechercher des sources",
  "Search the wider web": "Rechercher sur le Web", "Save to notes": "Enregistrer dans les notes",
  "Sign in to save notes.": "Connectez-vous pour enregistrer des notes.",
  "Could not save the note.": "La note n’a pas pu être enregistrée.",
  "Added to your private note (reopen the topic to see it).": "Ajouté à votre note privée (rouvrez le sujet pour la voir).",
  "Tools for": "Outils pour", "About": "À propos de", "Close concept panel": "Fermer le panneau du concept",
  "No definition is available yet. Explore related topics and sources below.": "Aucune définition n’est disponible pour le moment. Consultez les sujets et les sources liés ci-dessous.",
  "Could not look this up right now.": "Cette recherche n’est pas disponible pour le moment.",
  "No matching topic.": "Aucun sujet correspondant.", "Sources": "Sources", "No matching source.": "Aucune source correspondante.",
  "Curiosity, Sourced searches its own topics and sources first. For the wider web,": "La recherche commence par les sujets et les sources de Curiosity, Sourced. Pour le reste du Web,",
  "open a web search in a new tab ↗": "ouvrez une recherche dans un nouvel onglet ↗",
} as const;

export type ReaderUIKey = keyof typeof FRENCH;
export function readerUI(lang: LanguageCode, key: ReaderUIKey): string {
  return lang === "fr" ? FRENCH[key] : key;
}

export function readerGroup(lang: LanguageCode, kind: string): string {
  const keys: Record<string, ReaderUIKey> = { books: "Books", papers: "Papers", videos: "Videos", articles: "Articles", pdfs: "PDFs", podcasts: "Podcasts", tools: "Tools" };
  const key = keys[kind];
  return key ? readerUI(lang, key) : kind;
}
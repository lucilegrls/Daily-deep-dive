/**
 * Catalogue wording: subject lanes, library categories, feed styles and looks.
 *
 * These names live in the database or in code in English. Here they get a
 * human translation for each interface language. Anything without a
 * translation falls back to the original English wording, so a new lane or
 * category still reads correctly the day it is added.
 *
 * Topic titles, context, takeaways and the sources themselves are NOT
 * translated: they stay in the language they were written and checked in.
 */

import type { LanguageCode } from "@/lib/i18n";

type Entry = { label: string; description?: string };
type Table = Record<string, Entry>;
type ByLang = Partial<Record<LanguageCode, Table>>;

const LANES: ByLang = {
  en: {
    "science-technology": { label: "Science, technology & AI" },
    "health-mind": { label: "Health, body & mind" },
    "business-economy": { label: "Business, money & economics" },
    "society-culture": { label: "Society, culture & politics" },
    "learning-work": { label: "Learning, focus & work" },
    "nature-everyday": { label: "Nature & everyday questions" },
    "world-travel": { label: "World, food & travel" },
    "animals-nature-why": { label: "Animals, nature & dumb questions" },
    "art-culture-society": { label: "Art, culture & society" },
    "body-health-nutrition": { label: "Body, health & nutrition" },
    "brain-behavior": { label: "Brain, psychology & behavior" },
    "business-marketing": { label: "Business & marketing" },
    "economics-investing": { label: "Economics, finance & investing" },
    "fitness-performance": { label: "Fitness & performance" },
    "law-tax-offshore": { label: "Law, tax & offshore" },
    "learning-focus": { label: "Learning & focus" },
    "mathematics-scientific-thinking": {
      label: "Mathematics & scientific thinking",
    },
    "politics-history-geopolitics": {
      label: "Politics, history & geopolitics",
    },
    "southeast-asia-food-travel": { label: "Southeast Asia, food & travel" },
    "technology-ai": { label: "Technology & AI" },
  },
  fr: {
    "science-technology": {
      label: "Sciences, technologie & IA",
      description: "Le vivant, les découvertes et les technologies qui transforment le monde.",
    },
    "health-mind": {
      label: "Santé, corps & esprit",
      description: "Le corps, le cerveau, la psychologie et la performance.",
    },
    "business-economy": {
      label: "Économie, finance & entreprises",
      description: "L'argent, les marchés et le fonctionnement des entreprises.",
    },
    "society-culture": {
      label: "Société, culture & politique",
      description: "Les idées, l'histoire, le droit et les institutions.",
    },
    "learning-work": {
      label: "Apprentissage, concentration & travail",
      description: "Apprendre, retenir, créer et mieux travailler.",
    },
    "nature-everyday": {
      label: "Nature & questions du quotidien",
      description: "Le monde vivant et les pourquoi de tous les jours.",
    },
    "world-travel": {
      label: "Monde, cuisine & voyage",
      description: "Les lieux, les cultures et ce que l'on mange.",
    },
    "animals-nature-why": {
      label: "Animaux, nature & pourquoi du quotidien",
      description: "Le vivant et les questions que personne ne tranche.",
    },
    "art-culture-society": {
      label: "Art, culture & société",
      description: "Comment les gens fabriquent du sens ensemble.",
    },
    "body-health-nutrition": {
      label: "Corps, santé & nutrition",
      description:
        "Comment le corps fonctionne vraiment, de la cellule aux habitudes.",
    },
    "brain-behavior": {
      label: "Cerveau, psychologie & comportement",
      description: "Pourquoi l'esprit fait ce qu'il fait.",
    },
    "business-marketing": {
      label: "Entreprise & marketing",
      description: "Comment les entreprises grandissent et persuadent.",
    },
    "economics-investing": {
      label: "Économie, finance & investissement",
      description: "L'argent, les marchés et la mécanique derrière.",
    },
    "fitness-performance": {
      label: "Sport & performance",
      description: "Entraînement, récupération et ce que dit la preuve.",
    },
    "law-tax-offshore": {
      label: "Droit, fiscalité & offshore",
      description: "Les règles, les structures et l'argent qui circule.",
    },
    "learning-focus": {
      label: "Apprentissage & concentration",
      description: "Comment on apprend, retient et tient son attention.",
    },
    "mathematics-scientific-thinking": {
      label: "Mathématiques & pensée scientifique",
      description: "Raisonnement, preuves et incertitude.",
    },
    "politics-history-geopolitics": {
      label: "Politique, histoire & géopolitique",
      description: "Le pouvoir, les institutions et les conflits.",
    },
    "southeast-asia-food-travel": {
      label: "Asie du Sud-Est, cuisine & voyage",
      description: "Les lieux, les cuisines et les cultures autour.",
    },
    "technology-ai": {
      label: "Technologie & IA",
      description: "Les systèmes sur lesquels tourne le monde moderne.",
    },
  },
  es: {
    "science-technology": { label: "Ciencia, tecnología e IA" },
    "health-mind": { label: "Salud, cuerpo y mente" },
    "business-economy": { label: "Economía, finanzas y negocios" },
    "society-culture": { label: "Sociedad, cultura y política" },
    "learning-work": { label: "Aprendizaje, concentración y trabajo" },
    "nature-everyday": { label: "Naturaleza y preguntas cotidianas" },
    "world-travel": { label: "Mundo, comida y viajes" },
    "animals-nature-why": {
      label: "Animales, naturaleza y porqués cotidianos",
      description: "Lo vivo y las preguntas que nadie resuelve.",
    },
    "art-culture-society": {
      label: "Arte, cultura y sociedad",
      description: "Cómo las personas crean sentido en común.",
    },
    "body-health-nutrition": {
      label: "Cuerpo, salud y nutrición",
      description:
        "Cómo funciona el cuerpo de verdad, de las células a los hábitos.",
    },
    "brain-behavior": {
      label: "Cerebro, psicología y conducta",
      description: "Por qué la mente hace lo que hace.",
    },
    "business-marketing": {
      label: "Negocios y marketing",
      description: "Cómo crecen las empresas y cómo persuaden.",
    },
    "economics-investing": {
      label: "Economía, finanzas e inversión",
      description: "El dinero, los mercados y su maquinaria.",
    },
    "fitness-performance": {
      label: "Deporte y rendimiento",
      description: "Entrenamiento, recuperación y qué dice la evidencia.",
    },
    "law-tax-offshore": {
      label: "Derecho, impuestos y offshore",
      description: "Reglas, estructuras y el dinero que se mueve entre ellas.",
    },
    "learning-focus": {
      label: "Aprendizaje y concentración",
      description: "Cómo aprendemos, recordamos y sostenemos la atención.",
    },
    "mathematics-scientific-thinking": {
      label: "Matemáticas y pensamiento científico",
      description: "Razonamiento, evidencia e incertidumbre.",
    },
    "politics-history-geopolitics": {
      label: "Política, historia y geopolítica",
      description: "El poder, las instituciones y los conflictos.",
    },
    "southeast-asia-food-travel": {
      label: "Sudeste Asiático, comida y viajes",
      description: "Lugares, cocinas y las culturas que los rodean.",
    },
    "technology-ai": {
      label: "Tecnología e IA",
      description: "Los sistemas sobre los que funciona el mundo moderno.",
    },
  },
  zh: {
    "science-technology": { label: "科学、技术与人工智能" },
    "health-mind": { label: "健康、身体与心理" },
    "business-economy": { label: "经济、金融与商业" },
    "society-culture": { label: "社会、文化与政治" },
    "learning-work": { label: "学习、专注与工作" },
    "nature-everyday": { label: "自然与日常问题" },
    "world-travel": { label: "世界、饮食与旅行" },
    "animals-nature-why": {
      label: "动物、自然与日常为什么",
      description: "生命，以及没人给出答案的问题。",
    },
    "art-culture-society": {
      label: "艺术、文化与社会",
      description: "人们如何共同创造意义。",
    },
    "body-health-nutrition": {
      label: "身体、健康与营养",
      description: "身体真正的运作方式，从细胞到日常习惯。",
    },
    "brain-behavior": {
      label: "大脑、心理与行为",
      description: "心智为何这样运作。",
    },
    "business-marketing": {
      label: "商业与市场营销",
      description: "企业如何成长，又如何说服他人。",
    },
    "economics-investing": {
      label: "经济、金融与投资",
      description: "金钱、市场与背后的机制。",
    },
    "fitness-performance": {
      label: "健身与运动表现",
      description: "训练、恢复，以及证据支持的做法。",
    },
    "law-tax-offshore": {
      label: "法律、税务与离岸",
      description: "规则、架构，以及其中流动的资金。",
    },
    "learning-focus": {
      label: "学习与专注",
      description: "我们如何学习、记忆并保持注意力。",
    },
    "mathematics-scientific-thinking": {
      label: "数学与科学思维",
      description: "推理、证据与不确定性。",
    },
    "politics-history-geopolitics": {
      label: "政治、历史与地缘政治",
      description: "权力、制度与塑造它们的冲突。",
    },
    "southeast-asia-food-travel": {
      label: "东南亚、饮食与旅行",
      description: "地方、厨房与周围的文化。",
    },
    "technology-ai": {
      label: "科技与人工智能",
      description: "现代世界赖以运转的系统。",
    },
  },
  ar: {
    "science-technology": { label: "العلوم والتقنية والذكاء الاصطناعي" },
    "health-mind": { label: "الصحة والجسد والعقل" },
    "business-economy": { label: "الاقتصاد والمال والأعمال" },
    "society-culture": { label: "المجتمع والثقافة والسياسة" },
    "learning-work": { label: "التعلّم والتركيز والعمل" },
    "nature-everyday": { label: "الطبيعة وأسئلة الحياة اليومية" },
    "world-travel": { label: "العالم والطعام والسفر" },
    "animals-nature-why": {
      label: "الحيوانات والطبيعة وأسئلة الحياة اليومية",
      description: "الكائنات الحية والأسئلة التي لا يجيب عنها أحد.",
    },
    "art-culture-society": {
      label: "الفن والثقافة والمجتمع",
      description: "كيف يصنع الناس المعنى معًا.",
    },
    "body-health-nutrition": {
      label: "الجسد والصحة والتغذية",
      description: "كيف يعمل الجسد فعلًا، من الخلية إلى العادات اليومية.",
    },
    "brain-behavior": {
      label: "الدماغ وعلم النفس والسلوك",
      description: "لماذا يتصرف العقل كما يتصرف.",
    },
    "business-marketing": {
      label: "الأعمال والتسويق",
      description: "كيف تنمو الشركات وكيف تُقنع.",
    },
    "economics-investing": {
      label: "الاقتصاد والمال والاستثمار",
      description: "المال والأسواق والآلية التي تحركها.",
    },
    "fitness-performance": {
      label: "اللياقة والأداء",
      description: "التدريب والتعافي وما تدعمه الأدلة.",
    },
    "law-tax-offshore": {
      label: "القانون والضرائب والأوفشور",
      description: "القواعد والهياكل والأموال التي تتنقل بينها.",
    },
    "learning-focus": {
      label: "التعلّم والتركيز",
      description: "كيف نتعلم ونتذكر ونحافظ على الانتباه.",
    },
    "mathematics-scientific-thinking": {
      label: "الرياضيات والتفكير العلمي",
      description: "الاستدلال والأدلة وعدم اليقين.",
    },
    "politics-history-geopolitics": {
      label: "السياسة والتاريخ والجغرافيا السياسية",
      description: "السلطة والمؤسسات والصراعات التي تشكّلها.",
    },
    "southeast-asia-food-travel": {
      label: "جنوب شرق آسيا والطعام والسفر",
      description: "الأماكن والمطابخ والثقافات المحيطة بها.",
    },
    "technology-ai": {
      label: "التقنية والذكاء الاصطناعي",
      description: "الأنظمة التي يقوم عليها العالم الحديث.",
    },
  },
};

const CATEGORIES: ByLang = {
  en: {
    "Everyday why": { label: "Dumb questions" },
  },
  fr: {
    "AI & LLMs": { label: "IA & grands modèles" },
    "Animals & nature": { label: "Animaux & nature" },
    "Art & culture": { label: "Art & culture" },
    "Biochemistry & biology": { label: "Biochimie & biologie" },
    "Digital rights & law": { label: "Droits numériques & droit" },
    "Everyday why": { label: "Pourquoi du quotidien" },
    History: { label: "Histoire" },
    Mathematics: { label: "Mathématiques" },
    "Science & technology": { label: "Sciences & technologie" },
    "Finance & economics": { label: "Finance & économie" },
    "Fitness & performance": { label: "Sport & performance" },
    "Health & nutrition": { label: "Santé & nutrition" },
    Law: { label: "Droit" },
    "Learning & study": { label: "Apprentissage & études" },
    "Marketing & business": { label: "Marketing & entreprise" },
    "Menstrual health & hormones": { label: "Cycle & hormones" },
    "Neuroscience & the brain": { label: "Neurosciences & cerveau" },
    "Philosophy & ethics": { label: "Philosophie & éthique" },
    "Politics & institutions": { label: "Politique & institutions" },
    "Productivity & focus": { label: "Productivité & concentration" },
    "Psychology & behavior": { label: "Psychologie & comportement" },
    "Recent promising research": { label: "Recherches prometteuses" },
  },
  es: {
    "AI & LLMs": { label: "IA y grandes modelos" },
    "Animals & nature": { label: "Animales y naturaleza" },
    "Art & culture": { label: "Arte y cultura" },
    "Biochemistry & biology": { label: "Bioquímica y biología" },
    "Digital rights & law": { label: "Derechos digitales y derecho" },
    "Everyday why": { label: "Porqués cotidianos" },
    History: { label: "Historia" },
    Mathematics: { label: "Matemáticas" },
    "Science & technology": { label: "Ciencia y tecnología" },
    "Finance & economics": { label: "Finanzas y economía" },
    "Fitness & performance": { label: "Deporte y rendimiento" },
    "Health & nutrition": { label: "Salud y nutrición" },
    Law: { label: "Derecho" },
    "Learning & study": { label: "Aprendizaje y estudio" },
    "Marketing & business": { label: "Marketing y negocios" },
    "Menstrual health & hormones": { label: "Ciclo menstrual y hormonas" },
    "Neuroscience & the brain": { label: "Neurociencia y cerebro" },
    "Philosophy & ethics": { label: "Filosofía y ética" },
    "Politics & institutions": { label: "Política e instituciones" },
    "Productivity & focus": { label: "Productividad y concentración" },
    "Psychology & behavior": { label: "Psicología y conducta" },
    "Recent promising research": { label: "Investigación prometedora" },
  },
  zh: {
    "AI & LLMs": { label: "人工智能与大模型" },
    "Animals & nature": { label: "动物与自然" },
    "Art & culture": { label: "艺术与文化" },
    "Biochemistry & biology": { label: "生物化学与生物学" },
    "Digital rights & law": { label: "数字权利与法律" },
    "Everyday why": { label: "日常为什么" },
    History: { label: "历史" },
    Mathematics: { label: "数学" },
    "Science & technology": { label: "科学与技术" },
    "Finance & economics": { label: "金融与经济" },
    "Fitness & performance": { label: "健身与运动表现" },
    "Health & nutrition": { label: "健康与营养" },
    Law: { label: "法律" },
    "Learning & study": { label: "学习与研究方法" },
    "Marketing & business": { label: "市场营销与商业" },
    "Menstrual health & hormones": { label: "月经健康与激素" },
    "Neuroscience & the brain": { label: "神经科学与大脑" },
    "Philosophy & ethics": { label: "哲学与伦理" },
    "Politics & institutions": { label: "政治与制度" },
    "Productivity & focus": { label: "效率与专注" },
    "Psychology & behavior": { label: "心理与行为" },
    "Recent promising research": { label: "值得关注的新研究" },
  },
  ar: {
    "AI & LLMs": { label: "الذكاء الاصطناعي والنماذج اللغوية" },
    "Animals & nature": { label: "الحيوانات والطبيعة" },
    "Art & culture": { label: "الفن والثقافة" },
    "Biochemistry & biology": { label: "الكيمياء الحيوية والأحياء" },
    "Digital rights & law": { label: "الحقوق الرقمية والقانون" },
    "Everyday why": { label: "أسئلة الحياة اليومية" },
    History: { label: "التاريخ" },
    Mathematics: { label: "الرياضيات" },
    "Science & technology": { label: "العلوم والتكنولوجيا" },
    "Finance & economics": { label: "المال والاقتصاد" },
    "Fitness & performance": { label: "اللياقة والأداء" },
    "Health & nutrition": { label: "الصحة والتغذية" },
    Law: { label: "القانون" },
    "Learning & study": { label: "التعلّم والدراسة" },
    "Marketing & business": { label: "التسويق والأعمال" },
    "Menstrual health & hormones": { label: "صحة الدورة والهرمونات" },
    "Neuroscience & the brain": { label: "علم الأعصاب والدماغ" },
    "Philosophy & ethics": { label: "الفلسفة والأخلاق" },
    "Politics & institutions": { label: "السياسة والمؤسسات" },
    "Productivity & focus": { label: "الإنتاجية والتركيز" },
    "Psychology & behavior": { label: "علم النفس والسلوك" },
    "Recent promising research": { label: "أبحاث حديثة واعدة" },
  },
};

const CATEGORY_ALIASES: Record<string, string> = {
  "science & technology": "Science & technology",
  "economics & personal finance": "Finance & economics",
  "finance & economics": "Finance & economics",
};

const STORED_CATEGORY_VARIANTS: Record<string, string[]> = {
  "Science & technology": ["Science & technology", "Science & Technology"],
  "Finance & economics": [
    "Finance & economics",
    "Economics & personal finance",
  ],
};

/** A stable display/filter value for legacy editorial category spellings. */
export function normalizeCategory(category: string): string {
  const trimmed = category.trim();
  return CATEGORY_ALIASES[trimmed.toLocaleLowerCase("en-US")] ?? trimmed;
}

/** Every stored category represented by a normalized filter value. */
export function categoryVariants(category: string): string[] {
  const canonical = normalizeCategory(category);
  return STORED_CATEGORY_VARIANTS[canonical] ?? [canonical];
}

const MIXES: ByLang = {
  fr: {
    focused: {
      label: "Ciblé",
      description: "Surtout les sujets choisis, avec un détour de temps en temps.",
    },
    balanced: {
      label: "Équilibré",
      description: "Vos sujets, avec des découvertes régulières.",
    },
    exploratory: {
      label: "Exploratoire",
      description: "Moitié vos sujets, moitié des choses inattendues.",
    },
  },
  es: {
    focused: {
      label: "Enfocado",
      description: "Sobre todo tus temas, con algún desvío.",
    },
    balanced: {
      label: "Equilibrado",
      description: "Tus temas, con descubrimientos frecuentes.",
    },
    exploratory: {
      label: "Explorador",
      description: "Mitad tus temas, mitad cosas que nunca pediste.",
    },
  },
  zh: {
    focused: { label: "专注", description: "主要是你选的主题，偶尔绕个弯。" },
    balanced: { label: "平衡", description: "你的主题，穿插固定的新发现。" },
    exploratory: {
      label: "探索",
      description: "一半是你的主题，一半是你从未想到的内容。",
    },
  },
  ar: {
    focused: {
      label: "مركّز",
      description: "غالبًا المواضيع التي اخترتها، مع انعطافة من حين لآخر.",
    },
    balanced: {
      label: "متوازن",
      description: "مواضيعك، مع اكتشافات منتظمة بينها.",
    },
    exploratory: {
      label: "استكشافي",
      description: "نصف مواضيعك، ونصف أشياء لم تطلبها أبدًا.",
    },
  },
};

const THEME_LABELS: ByLang = {
  fr: {
    romantic: {
      label: "Romantique",
      description: "Papier crème, dentelle et sceau de cire.",
    },
    minimal: {
      label: "Minimaliste",
      description: "Espaces blancs, typographie sobre, aucun ornement.",
    },
    inky: {
      label: "Encre",
      description: "Vert profond et charbon, serif épaisse.",
    },
    maximal: {
      label: "Maximaliste",
      description: "Couleurs fortes, grosses lettres, angles arrondis.",
    },
    retro: {
      label: "Impression rétro",
      description: "Chaleur du papier journal et encre vintage.",
    },
    y2k: { label: "Y2K", description: "Bleus chromés, formes bulles, brillance." },
    academia: {
      label: "Dark academia",
      description: "Bordeaux, parchemin et lumière de bougie.",
    },
  },
  es: {
    romantic: {
      label: "Romántico",
      description: "Papel crema, encaje y sello de lacre.",
    },
    minimal: {
      label: "Minimalista",
      description: "Espacio en blanco, tipografía serena, sin adornos.",
    },
    inky: {
      label: "Tinta",
      description: "Verde profundo y carbón, serif contundente.",
    },
    maximal: {
      label: "Maximalista",
      description: "Color intenso, letras gruesas, esquinas amplias.",
    },
    retro: {
      label: "Impresión retro",
      description: "Calidez de papel de periódico y tinta vintage.",
    },
    y2k: { label: "Y2K", description: "Azules cromados, formas burbuja, brillo." },
    academia: {
      label: "Dark academia",
      description: "Burdeos, pergamino y luz de vela.",
    },
  },
  zh: {
    romantic: { label: "浪漫", description: "米色纹纸、蕾丝与火漆印。" },
    minimal: { label: "极简", description: "留白、安静的字体，毫无装饰。" },
    inky: { label: "墨色", description: "深绿与炭黑，厚重衬线体。" },
    maximal: { label: "繁复", description: "浓烈色彩、粗字体、大圆角。" },
    retro: { label: "复古印刷", description: "报纸的暖调与老式油墨。" },
    y2k: { label: "千禧", description: "铬蓝色、气泡造型与光泽。" },
    academia: { label: "暗黑学院", description: "酒红、羊皮纸与烛光。" },
  },
  ar: {
    romantic: {
      label: "رومانسي",
      description: "ورق كريمي ودانتيل وختم شمعي.",
    },
    minimal: {
      label: "بسيط",
      description: "مساحات بيضاء وخط هادئ بلا زخرفة.",
    },
    inky: { label: "حبري", description: "أخضر داكن وفحمي وخط ثقيل." },
    maximal: { label: "متعدّد", description: "ألوان صاخبة وحروف عريضة وزوايا دائرية." },
    retro: { label: "طباعة قديمة", description: "دفء ورق الصحف وحبر عتيق." },
    y2k: { label: "Y2K", description: "أزرق كرومي وأشكال فقاعية ولمعان." },
    academia: {
      label: "أكاديمية داكنة",
      description: "نبيذي ورقّ وضوء شموع.",
    },
  },
};

function pick(
  tables: ByLang,
  lang: LanguageCode,
  key: string,
): Entry | undefined {
  return tables[lang]?.[key];
}

export function laneName(lang: LanguageCode, slug: string, fallback: string) {
  return pick(LANES, lang, slug)?.label ?? fallback;
}

export function laneDescription(
  lang: LanguageCode,
  slug: string,
  fallback: string,
) {
  return pick(LANES, lang, slug)?.description ?? fallback;
}

export function categoryName(lang: LanguageCode, category: string) {
  const canonical = normalizeCategory(category);
  return pick(CATEGORIES, lang, canonical)?.label ?? canonical;
}

export function feedMixName(lang: LanguageCode, id: string, fallback: string) {
  return pick(MIXES, lang, id)?.label ?? fallback;
}

export function feedMixDescription(
  lang: LanguageCode,
  id: string,
  fallback: string,
) {
  return pick(MIXES, lang, id)?.description ?? fallback;
}

export function themeName(lang: LanguageCode, id: string, fallback: string) {
  return pick(THEME_LABELS, lang, id)?.label ?? fallback;
}

export function themeDescription(
  lang: LanguageCode,
  id: string,
  fallback: string,
) {
  return pick(THEME_LABELS, lang, id)?.description ?? fallback;
}

/**
 * The object a reader opens in each look, used in the welcome wording so the
 * introduction never says "envelope" for a theme that shows a telephone.
 * `one` carries the article or measure word each language needs; `bare` is the
 * plain noun used after "every".
 */
type Gateway = { one: string; bare: string };
const GATEWAY_NOUNS: Partial<Record<LanguageCode, Record<string, Gateway>>> = {
  en: {
    romantic: { one: "an envelope", bare: "envelope" },
    minimal: { one: "a card", bare: "card" },
    inky: { one: "a page", bare: "page" },
    maximal: { one: "a call", bare: "call" },
    retro: { one: "a ticket", bare: "ticket" },
    y2k: { one: "a cassette", bare: "cassette" },
    academia: { one: "a seal", bare: "seal" },
  },
  fr: {
    romantic: { one: "une enveloppe", bare: "enveloppe" },
    minimal: { one: "une fiche", bare: "fiche" },
    inky: { one: "une page", bare: "page" },
    maximal: { one: "un appel", bare: "appel" },
    retro: { one: "un billet", bare: "billet" },
    y2k: { one: "une cassette", bare: "cassette" },
    academia: { one: "un sceau", bare: "sceau" },
  },
  es: {
    romantic: { one: "un sobre", bare: "sobre" },
    minimal: { one: "una ficha", bare: "ficha" },
    inky: { one: "una página", bare: "página" },
    maximal: { one: "una llamada", bare: "llamada" },
    retro: { one: "un billete", bare: "billete" },
    y2k: { one: "un casete", bare: "casete" },
    academia: { one: "un sello", bare: "sello" },
  },
  zh: {
    romantic: { one: "一封信笺", bare: "信笺" },
    minimal: { one: "一张卡片", bare: "卡片" },
    inky: { one: "一页书稿", bare: "书页" },
    maximal: { one: "一通来电", bare: "来电" },
    retro: { one: "一张票根", bare: "票根" },
    y2k: { one: "一盒磁带", bare: "磁带" },
    academia: { one: "一枚封印", bare: "封印" },
  },
  ar: {
    romantic: { one: "مظروفًا", bare: "مظروف" },
    minimal: { one: "بطاقة", bare: "بطاقة" },
    inky: { one: "صفحة", bare: "صفحة" },
    maximal: { one: "مكالمة", bare: "مكالمة" },
    retro: { one: "تذكرة", bare: "تذكرة" },
    y2k: { one: "شريطًا", bare: "شريط" },
    academia: { one: "ختمًا", bare: "ختم" },
  },
};

/** The look's object, in the reader's language. */
export function gatewayNoun(
  lang: LanguageCode,
  themeId: string,
  form: "one" | "bare" = "bare",
) {
  const table = GATEWAY_NOUNS[lang] ?? GATEWAY_NOUNS.en!;
  const entry =
    table[themeId] ??
    GATEWAY_NOUNS.en![themeId] ??
    table["romantic"] ??
    GATEWAY_NOUNS.en!["romantic"]!;
  return entry[form];
}

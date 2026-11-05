# Daily Deep Dive — Repository Update Handoff

_Last updated: 19 September 2026_

This document is intended to be uploaded into the **Repository Update** Work chat. It supplements the earlier `Daily_Deep_Dive_Project_Context(1).md` file and captures the latest product decisions, topic expansion, and video-curation rules agreed after 17 September 2026.

---

## 1. Product goal

**Daily Deep Dive** should become a polished, market-ready knowledge discovery app that does **not** look or feel like generic AI-generated content.

The desired product is:

- visually distinctive
- editorial / tactile / slightly vintage
- calm and premium
- substantive rather than gimmicky
- continuously scrollable
- capable of expanding to hundreds or thousands of topics
- curated rather than generated blindly
- useful enough to become a real consumer learning product

The content experience should feel closer to a carefully edited intellectual discovery feed than to a chatbot, flashcard app, or generic “daily facts” product.

---

## 2. Important UI/product decisions added after the previous context file

Preserve all earlier design decisions unless explicitly changed, plus the following:

### Envelope

- **Do not display a number of resources on top of the envelope.**
- Remove the word **“resources”** and any unnecessary text around/on the envelope.
- The envelope itself remains an important visual interaction.
- Each topic in the scrolling feed should have its own envelope.
- Opening an envelope should reveal only the resources for that topic.

### Feed

- The app is **not limited to one topic per day**.
- It should be a continuous vertical feed with many topics to scroll through.
- The app should feel effectively infinite.
- Do not hard-code a fixed number of subjects.
- New topics should continue to be added over time.
- Content generation should aim for **at least 10 strong new topics per day** when expanding the library.
- Do not recycle the same few topics as a substitute for growth.

### Design

- Keep the current color palette unless intentionally refined later.
- The product should look less “AI-made.”
- Future images/visual references will be uploaded separately to further improve the visual identity.
- Avoid generic gradients, generic SaaS cards, obvious AI-generated decorative patterns, and generic productivity-app aesthetics.

---

## 3. Resource-quality rules

Every topic should contain genuinely useful resources.

### Permanent rules

- **No Wikipedia.**
- Do not add Wikipedia even as a temporary filler.
- Do not use a weak source merely to reach a target count.
- There is **no fixed number of resources** per topic.
- Quality and usefulness matter more than quantity.
- A topic should not be published as “complete” if the resources are superficial.

### Preferred source hierarchy

When appropriate, prefer:

1. primary sources
2. peer-reviewed research
3. official institutions / regulators
4. academic references and universities
5. domain specialists
6. established educational creators
7. strong long-form journalism / documentary explainers

Avoid:

- Wikipedia
- SEO content farms
- superficial listicles
- low-substance clickbait
- generic AI-written explainers
- duplicate resources that add nothing new

---

## 4. New permanent video rule

**Every individual topic should contain at least one genuinely educational video.**

The video is an additional resource type and does not replace books, papers, articles, or other resources.

### What counts as a good Daily Deep Dive video

The viewer should finish the video understanding **how something works**, not merely knowing what it is.

For science/body topics, the ideal structure resembles:

> molecule / structure → interaction → pathway → mechanism → consequence

For economics/business:

> actors → incentives → transaction / flow → feedback loop → outcome

For history:

> context → causes → sequence → turning point → consequence / legacy

For law:

> rule → legal test → parties / rights / obligations → procedure → practical consequence

### Preferred video hierarchy

1. **Mechanistic / visual explainer**
2. **Specialist or expert explainer**
3. **Excellent science/documentary storytelling**
4. **Rigorous long-form expert discussion**
5. **University lecture when it is genuinely the clearest/deepest option**

University prestige alone is not enough. A specialist educator with excellent diagrams may be better than a prestigious but dry lecture.

### Video length

No fixed length.

Good videos may be:

- 5–15 minutes if dense and well explained
- 20–40 minutes for a focused deep dive
- 1–3 hours when the long-form expert discussion is genuinely valuable

### Explicit exclusions when learning from Lucile's YouTube history

Do **not** use the following as signals for educational recommendations:

- music
- Privileged Few
- Cut
- zoeunlimited
- entertainment / celebrity commentary
- lifestyle content without substantive teaching
- non-educational videos generally

### Video-style signals that DO matter

Strong preference signals include:

- **Dr Matt & Dr Mike** — visual physiology/biochemistry and pathway explanations
- **Dr Sahar Yousef** — expert neuroscience explained accessibly
- **Cleo Abram** — polished science storytelling with real substance
- **specialist physicians / scientists** explaining a narrow question clearly
- **Khan Academy / similar structured educators** when the explanation is strong
- **high-quality explanatory journalism** for current affairs, AI, economics, etc., when it actually explains rather than merely reports
- **long-form expert conversations** when they genuinely teach

Country does not matter. Avoid accidentally over-selecting sources from one country merely because search ranking surfaces them first.

### Video rejection criteria

Reject:

- Shorts used as the primary resource for a complex topic
- “5 facts you need to know” style videos with no mechanism
- generic motivation
- title-match-only selection
- clickbait with little substance
- videos relying primarily on Wikipedia as their research base
- health/science videos making claims without credible evidence

### Suggested video metadata

For each video, store or be prepared to store:

```json
{
  "title": "...",
  "creator": "...",
  "url": "...",
  "duration": "...",
  "difficulty": "intro | intermediate | deep",
  "format": "visual mechanism | specialist explainer | documentary storytelling | long-form discussion | lecture",
  "conceptsCovered": [],
  "credibilityNotes": "...",
  "selectionReason": "...",
  "reviewStatus": "candidate | approved | rejected",
  "rejectionReason": "...",
  "lastChecked": "YYYY-MM-DD"
}
```

### Benchmark video

A benchmark for the desired science style is:

**Iron Physiology | Diet, Absorption, Storage, and Function — Dr Matt & Dr Mike**

It works because it moves beyond “iron is important” and actually explains absorption, transport, storage, and function.

---

## 5. Topic-generation philosophy

There should be **no fixed universe of topics**.

The app should continuously discover new topics across disciplines.

Existing and desired subject directions include, but are not limited to:

- body mechanisms
- nutrition
- vitamins and minerals
- glucose/fructose
- hormones
- dopamine
- neuroscience
- brain function
- cells
- health
- food
- social media
- psychology
- study methods
- marketing
- economics
- bonds
- investment
- business
- tax
- offshore structures
- corporate law
- intellectual property
- politics / institutions
- geopolitics
- current wars
- historical conflicts
- Vietnam War
- culture
- art
- mathematics
- animals
- everyday “why?” questions
- experiments
- technology
- AI

Topic ideas should be specific enough to create a real rabbit hole.

Avoid entries like:

- “Biology”
- “Finance”
- “History”

Prefer entries like:

- “How banks create money when they lend”
- “Why metal feels colder than wood at the same temperature”
- “How octopuses think with their arms”
- “Why one gene can make different proteins”

---

# 6. NEW TOPIC BANK

The following ideas were reviewed positively as directions for the app. They can be added progressively, with proper context, takeaways, and verified resources.

---

## A. Science, body, technology & systems — 20 topics

1. **The glymphatic system: how the brain cleans itself** — CSF circulation, waste clearance, sleep, aquaporin-4, metabolic waste.
2. **mTOR vs AMPK: your body's growth and energy switches** — growth, conservation, exercise, fasting, nutrition, metabolism.
3. **How proteins fold — and what happens when they don't** — amino acids, 3D structure, chaperones, misfolding, aggregation.
4. **Epigenetic clocks: can we measure biological age?** — DNA methylation, chronological vs biological age, limitations.
5. **The placebo and nocebo effect inside the brain** — expectation, endogenous opioids, dopamine, pain pathways.
6. **The blood-brain barrier: what is allowed into your brain?** — endothelial cells, tight junctions, transporters, drugs, toxins.
7. **Your skeleton is constantly destroying and rebuilding itself** — osteoclasts, osteoblasts, calcium, vitamin D, PTH, loading.
8. **Lactate is not just “muscle waste”** — glycolysis, pyruvate, lactate shuttle, liver, brain, fatigue.
9. **How your body adapts to extreme heat** — sweating, plasma volume, aldosterone, heat-shock proteins, acclimation.
10. **Endocrine disruptors: how chemicals can imitate hormones** — receptors, agonists/antagonists, dose-response, BPA, phthalates.
11. **RNA splicing: how one gene can make different proteins** — pre-mRNA, introns, exons, spliceosome, alternative splicing.
12. **Your microbiome is a chemical factory** — SCFAs, bile acids, fermentation, immune/metabolic signaling.
13. **Stablecoins: what actually keeps a digital dollar worth $1?** — reserves, redemption, arbitrage, depegging, settlement.
14. **How a semiconductor is actually made** — wafers, photolithography, doping, etching, deposition, transistors, packaging.
15. **The internet is mostly physical: undersea cables** — fiber optics, repeaters, landing stations, routing, data centers.
16. **How recommendation algorithms decide what you see** — candidate generation, ranking, engagement signals, embeddings, feedback loops.
17. **How do we prove an image or video is real in the AI era?** — metadata, signatures, content credentials, provenance, detection limitations.
18. **Dark patterns: when interface design manipulates your decisions** — defaults, friction, scarcity cues, consumer law, behavioral economics.
19. **Why monopolies emerge naturally in some digital markets** — network effects, switching costs, scale, platforms, two-sided markets.
20. **How insurance companies insure disasters bigger than themselves** — risk pooling, underwriting, reinsurance, catastrophe bonds.

---

## B. History — 20 topics

1. **The fall of the Roman Republic** — institutions, inequality, civil war, patronage, military loyalty, Augustus.
2. **The Scramble for Africa** — Berlin Conference, colonial borders, extraction, long-term consequences.
3. **The Opium Wars** — trade imbalance, silver, opium, Qing China, unequal treaties, treaty ports.
4. **The South Sea Bubble of 1720** — public debt, speculation, insider behavior, financial mania.
5. **The Nuremberg Trials and the birth of modern international criminal law** — crimes against humanity, individual liability, command responsibility.
6. **How the Ottoman Empire governed such a diverse territory** — millet systems, taxation, administration, Janissaries, trade.
7. **Salt as a political weapon** — salt taxes, imperial China, Gandhi, colonial control.
8. **The Haitian Revolution** — slavery, French colonial wealth, Toussaint Louverture, Napoleon, independence.
9. **How the Medici built power through banking** — finance, political networks, papal banking, patronage, Florence.
10. **The Dutch East India Company: the world’s first mega-corporation?** — shares, monopoly rights, governance, colonial violence.
11. **The Magna Carta: what it actually changed** — King John, barons, due process, later reinterpretation.
12. **How Versailles controlled the French nobility** — ritual, status competition, patronage, architecture, political control.
13. **The Black Death and how it transformed European society** — mortality, wages, labor scarcity, religion, mobility.
14. **The Cuban Missile Crisis — day by day** — intelligence, nuclear deterrence, negotiation, escalation risk.
15. **The Industrial Revolution from the worker’s point of view** — factories, child labor, urbanization, wages, unions.
16. **The Green Revolution** — high-yield crops, fertilizers, irrigation, food security, environmental costs.
17. **How propaganda worked during the Cold War** — radio, film, newspapers, cultural diplomacy, influence campaigns.
18. **Why cities built walls — and why they stopped** — defense, taxation, siege warfare, cannons, urban growth.
19. **The Thirty Years’ War and the making of the modern state system** — religion, dynastic politics, mercenaries, Westphalia.
20. **How universal suffrage gradually emerged** — property requirements, gender, class, reform, mass politics.

---

## C. Economics — 20 topics

1. **Why inflation can continue after the original shock is gone** — expectations, wages, second-round effects, persistence.
2. **How banks create money when they lend** — balance sheets, deposits, credit creation, reserves, capital requirements.
3. **Why interest rates affect almost everything** — mortgages, bonds, currencies, investment, consumption, valuations.
4. **Why currencies rise and fall** — rates, trade, capital flows, inflation, expectations, speculation.
5. **Why housing becomes unaffordable** — land, zoning, rates, construction, demand, demographics, credit.
6. **Why governments can borrow so much money** — sovereign debt, taxation capacity, refinancing, sustainability.
7. **Yield curves: why the shape of interest rates matters** — short vs long rates, expectations, term premium, inversions.
8. **Why companies are worth the present value of future cash flows** — discounting, risk, terminal value, valuation sensitivity.
9. **Why productivity determines long-term living standards** — technology, capital, education, institutions.
10. **Why some countries stay poor while others grow** — institutions, geography, human capital, trade, state capacity.
11. **What actually causes inequality** — wages, capital, technology, globalization, taxation, housing, inheritance.
12. **Why CEOs and top workers earn so much more than others** — superstar economics, scale, bargaining, winner-take-most markets.
13. **Why prices are not simply “cost + profit”** — marginal cost, willingness to pay, elasticity, competition.
14. **Price discrimination: why everyone pays a different price for the same thing** — airlines, hotels, segmentation, dynamic pricing.
15. **Behavioral economics: why humans systematically make “irrational” choices** — loss aversion, anchoring, defaults, present bias.
16. **Network effects: why some markets tip toward one winner** — platforms, payments, switching costs, scale.
17. **How supply chains transmit economic shocks** — inventories, bottlenecks, shipping, bullwhip effects, JIT production.
18. **Why minimum wages do not always behave like simple supply-and-demand diagrams predict** — monopsony, frictions, bargaining, empirical evidence.
19. **Why central banks need credibility** — expectations, inflation targeting, forward guidance, independence.
20. **How financial crises actually spread** — leverage, liquidity, margin calls, fire sales, bank runs, contagion.

---

## D. Culture — 20 topics

1. **Why rice cultures and wheat cultures developed differently** — agriculture, climate, labor coordination, cuisine, settlement.
2. **Why clothes communicate status before we even speak** — sumptuary laws, luxury, uniforms, class, subcultures.
3. **How beauty standards change across time and place** — body ideals, skin tone, hair, cosmetics, media, colonial influence.
4. **Why table manners are so different around the world** — utensils, communal eating, seating, etiquette, hierarchy.
5. **Why humans create rituals** — weddings, funerals, initiation, symbolism, bonding, uncertainty.
6. **Why every culture has ghosts** — ancestors, death, memory, religion, folklore, social fears.
7. **How language changes the way people think** — linguistic relativity, color, time, spatial orientation, Sapir–Whorf.
8. **Why luxury exists in every society** — scarcity, signaling, craftsmanship, conspicuous consumption.
9. **Why homes look so different across cultures** — climate, privacy, family structure, religion, materials.
10. **The culture of cafés and why they became intellectual spaces** — coffeehouses, newspapers, politics, literary culture.
11. **Why some societies value minimalism and others ornament** — aesthetics, religion, wealth, modernism, taste.
12. **Why marriage means such different things across societies** — romance, property, kinship, inheritance, dowry, bridewealth.
13. **How cultures define childhood differently** — schooling, work, play, independence, family expectations.
14. **How food becomes national identity** — migration, colonial exchange, invented traditions, authenticity.
15. **Why silence means different things in different cultures** — hierarchy, intimacy, disagreement, high/low-context communication.
16. **Why cultures experience time differently** — punctuality, work rhythms, waiting, industrialization.
17. **Why people behave differently in public and private** — face, honor, shame, reputation, impression management.
18. **The cultural history of cleanliness** — bathing, perfume, soap, disease theory, class, colonialism.
19. **Why embarrassment and shame are cultural emotions** — social norms, saving face, honor/guilt cultures, reputation.
20. **How cities create their own cultures** — neighborhoods, slang, nightlife, migration, architecture, class.

---

## E. Mathematics — 20 topics

1. **Different sizes of infinity** — countable vs uncountable infinity, Cantor’s diagonal argument.
2. **Why randomness is so unintuitive** — independence, expected value, regression to mean, gambler’s fallacy.
3. **The birthday paradox** — why 23 people create a >50% shared-birthday probability.
4. **The Monty Hall problem** — conditional probability and information.
5. **Why exponential growth fools the human brain** — doubling, compounding, epidemics, population.
6. **Chaos theory: how tiny differences become huge outcomes** — initial conditions, strange attractors, butterfly effect.
7. **Fractals: why the same patterns appear at different scales** — self-similarity, fractal dimension, Mandelbrot, nature.
8. **Prime numbers and why they matter for internet security** — factorization, modular arithmetic, RSA.
9. **How GPS uses geometry to find you** — trilateration, timing, coordinates, error correction.
10. **Bayes’ theorem: how evidence should change your beliefs** — priors, likelihoods, posteriors, medical tests, evidence.
11. **The mathematics of optimal decisions** — expected utility, uncertainty, payoff matrices.
12. **Game theory: why rational people sometimes make bad collective choices** — Nash equilibrium, prisoner’s dilemma, cooperation.
13. **How queueing theory explains waiting lines** — arrival rates, service rates, bottlenecks.
14. **Network mathematics: why some people and websites become hubs** — graph theory, centrality, preferential attachment.
15. **The mathematics of epidemics** — SIR models, reproduction numbers, thresholds.
16. **Why averages can lie** — mean vs median, skew, Simpson’s paradox, aggregation.
17. **Why the normal distribution appears everywhere** — central limit theorem, sampling, measurement error.
18. **Non-Euclidean geometry** — curved surfaces, spherical and hyperbolic geometry.
19. **Gödel’s incompleteness theorem** — true statements unprovable within sufficiently powerful systems.
20. **Why calculus works** — limits, derivatives, integrals, Fundamental Theorem of Calculus.

---

## F. Art — 20 topics

1. **Why Renaissance perspective changed painting forever** — geometry, vanishing points, Brunelleschi, Alberti.
2. **Why Impressionist paintings looked “unfinished” to their first audiences** — brushwork, light, photography, Salon culture.
3. **Why abstract art can still feel emotional** — color, shape, scale, rhythm, visual psychology.
4. **How artists manipulate where you look** — composition, contrast, focal points, visual hierarchy.
5. **The science of color in art** — pigments vs light, complementary colors, optical mixing.
6. **How marble becomes “skin” in sculpture** — carving, polishing, translucency, anatomy, contrapposto.
7. **Why old paintings crack, yellow, and change color** — varnish, oxidation, pigments, conservation science.
8. **Why some artworks become worth hundreds of millions** — scarcity, provenance, collectors, auctions, signaling.
9. **How experts detect forged art** — provenance, pigments, canvas dating, spectroscopy, XRF.
10. **How photography changed painting** — realism, cropping, movement, Impressionism, portraiture.
11. **Why museums look the way they do** — white cube, salon hangs, lighting, architecture, curatorial authority.
12. **Cubism: why Picasso and Braque broke objects apart** — multiple viewpoints, Cézanne, geometry, collage.
13. **How lighting changes an artwork** — chiaroscuro, Caravaggio, color temperature, shadow.
14. **How artists mixed pigments before modern paint tubes** — minerals, plants, insects, binders, grinding, toxic pigments.
15. **Why self-portraits became so important** — identity, status, mirrors, gender, self-fashioning.
16. **Street art: when does vandalism become art?** — public space, property law, Banksy, commercialization.
17. **Why ancient art often looks “less realistic” on purpose** — symbolism, hierarchy of scale, idealization.
18. **Why faces in portraits feel alive** — eye direction, symmetry, skin tone, sfumato, face perception.
19. **How art has been used as propaganda** — empires, Napoleon, Soviet realism, wartime posters.
20. **Can AI make art, and what exactly is it learning?** — diffusion, training data, style imitation, copyright, originality.

---

## G. Animals — 20 topics

1. **How octopuses think with their arms** — distributed nervous systems, arm autonomy, intelligence.
2. **How bees communicate with a dance** — waggle dance, direction, distance, sunlight, collective decisions.
3. **Do dolphins have names?** — signature whistles, vocal learning, individual recognition.
4. **How birds navigate across entire continents** — magnetoreception, stars, smell, landmarks, inherited maps.
5. **How echolocation creates a picture of the world** — ultrasound, echoes, Doppler shifts, spatial representation.
6. **Do elephants understand death?** — reactions to dead conspecifics, bones, social bonds, interpretation limits.
7. **How an ant colony behaves like one organism** — pheromones, decentralized decisions, division of labor, emergence.
8. **How whales communicate across oceans** — low-frequency sound, songs, dialects, cultural transmission.
9. **Why crows are frighteningly intelligent** — tools, planning, facial recognition, memory, social learning.
10. **How animals regenerate body parts** — axolotls, zebrafish, stem cells, blastema formation.
11. **How animals survive being frozen** — antifreeze proteins, cryoprotectants, controlled ice formation.
12. **What actually happens during hibernation** — metabolic suppression, temperature, heart rate, muscle preservation.
13. **How animals breathe through their skin** — diffusion, amphibian skin, oxygen gradients.
14. **How chameleons change color** — nanocrystals, structural coloration, iridophores, hormones.
15. **How squid and octopuses become invisible** — chromatophores, iridophores, papillae, neural control.
16. **How penguins survive Antarctic cold** — countercurrent heat exchange, feathers, fat, huddling.
17. **How domestication changed wolves into dogs** — selection, behavior, genetics, morphology, starch digestion.
18. **Do animals understand fairness?** — inequity-aversion experiments, cooperation, interpretation debates.
19. **How fish form schools without a leader** — local rules, vision, lateral-line sensing, synchronization.
20. **How metamorphosis rebuilds an animal** — hormones, imaginal discs, tissue remodeling, nervous-system changes.

---

## H. Everyday “Why?” — set 1 (20 topics)

This should become a **permanent, effectively infinite category** in Daily Deep Dive.

1. **Why do we get goosebumps?**
2. **Why does time feel faster as we get older?**
3. **Why do onions make us cry?**
4. **Why does metal feel colder than wood when they are the same temperature?**
5. **Why do we forget what we walked into a room for?**
6. **Why do our fingers wrinkle in water?**
7. **Why does spicy food feel hot when it isn't actually burning us?**
8. **Why do we yawn when someone else yawns?**
9. **Why do mirrors seem to reverse left and right but not up and down?**
10. **Why does your voice sound weird in recordings?**
11. **Why do we hiccup?**
12. **Why can’t you tickle yourself?**
13. **Why does alcohol make people pee more?**
14. **Why do we get brain freeze?**
15. **Why does rain have a smell?**
16. **Why do old books smell so good?**
17. **Why do airplanes dim the lights before takeoff and landing?**
18. **Why does your stomach make noises when you're hungry?**
19. **Why does water taste different from one city to another?**
20. **Why do we suddenly remember embarrassing moments from years ago?**

---

## I. Everyday “Why?” — set 2 (20 topics)

1. **Why do we get déjà vu?**
2. **Why do we blush?**
3. **Why does ice float?**
4. **Why do we dream?**
5. **Why do your ears pop on an airplane?**
6. **Why do traffic jams appear when there is no accident?**
7. **Why does popcorn pop?**
8. **Why are airplane windows round?**
9. **Why does toothpaste make orange juice taste disgusting?**
10. **Why do cats purr?**
11. **Why do mosquitoes bite some people more than others?**
12. **Why do we get pins and needles?**
13. **Why do we feel dizzy after spinning?**
14. **Why does your skin peel after a sunburn?**
15. **Why does bread go stale even before it dries out?**
16. **Why do some songs get stuck in your head?**
17. **Why do we sometimes wake up just before the alarm?**
18. **Why can we see our breath when it’s cold?**
19. **Why does salt melt ice?**
20. **Why do supermarkets put milk at the back?** — investigate whether the popular explanation is actually supported.

---

## J. Tax, law & business — 20 topics

1. **How multinational companies legally shift profits between countries** — transfer pricing, royalties, management fees, loans, IP, PE rules.
2. **What makes a company tax resident in a country?** — incorporation, management and control, substance, treaty rules.
3. **Why some expenses are tax-deductible and others are not** — business-purpose tests, capital vs revenue, documentation.
4. **Salary vs dividends vs director’s fees** — legal character, deductibility, withholding, payroll, individual tax.
5. **Why companies use holding companies** — ownership, dividends, capital gains, financing, governance, treaties.
6. **What creates a permanent establishment?** — offices, employees, agents, construction, remote work.
7. **How double tax treaties actually work** — residence/source, allocation rules, credits, beneficial ownership, anti-abuse.
8. **How VAT/GST works across a supply chain** — output/input tax, registration, imports, reverse charge, zero-rating.
9. **Why intellectual property is often at the center of tax planning** — royalties, licensing, DEMPE, patent boxes, withholding.
10. **Debt vs equity: why the legal form of financing matters** — interest, dividends, thin capitalization, insolvency ranking.
11. **How venture capital investment is legally structured** — preferred shares, liquidation preference, anti-dilution, SAFEs, vesting.
12. **What directors can actually be personally liable for** — fiduciary duties, conflicts, insolvency, negligence, fraud.
13. **What happens legally when a company suffers a data breach** — notification, contracts, regulation, insurance, cross-border data.
14. **Who is liable when AI makes the wrong decision?** — negligence, product liability, contracts, developers/users, oversight.
15. **Why contracts contain so many “boilerplate” clauses** — governing law, jurisdiction, force majeure, indemnity, limitation.
16. **Arbitration vs litigation: why companies choose one over the other** — confidentiality, enforceability, New York Convention, seat.
17. **How foreign investment restrictions actually work** — ownership caps, negative lists, licences, approvals, JVs, security screening.
18. **What actually happens in an M&A due diligence** — corporate, contracts, employment, tax, IP, litigation, licences, red flags.
19. **Why companies create subsidiaries instead of putting everything into one entity** — liability, regulation, tax, investors, risk segregation.
20. **How companies avoid tax without breaking the law — and where avoidance becomes abuse** — planning vs evasion, GAAR, substance, sham, anti-abuse.

---

## K. Offshore / cross-border structuring — 20 topics

Important framing: these should be **educational explanations**, not guides to hiding assets, evading tax, or bypassing regulation.

1. **What does “offshore” actually mean?** — offshore vs foreign company vs tax haven; legality and misconceptions.
2. **Why do companies incorporate in the Cayman Islands?** — funds, tax neutrality, legal predictability, investor familiarity.
3. **Why are BVI companies used so often?** — corporate law, administration, holding structures, JVs.
4. **What is a tax haven?** — low/no tax, secrecy, substance, information exchange, competing definitions.
5. **Offshore holding companies: what do they actually do?** — ownership, dividends, financing, exits, segregation, governance.
6. **How multi-layer corporate structures work** — parent, intermediate holding, operating company, IP/finance entities.
7. **Why economic substance rules changed offshore planning** — premises, employees, decision-making, CIGA.
8. **What is beneficial ownership?** — legal owner vs UBO, nominees, registers, AML.
9. **How nominee directors and shareholders work** — legal role, use cases, limitations, control.
10. **How offshore banking differs from offshore incorporation** — bank vs entity jurisdiction, KYC, source of funds, CRS/FATCA.
11. **How the Common Reporting Standard changed offshore secrecy** — automatic reporting, tax residence, participating jurisdictions.
12. **How FATCA made US tax reporting global** — US persons, FFIs, reporting, withholding consequences.
13. **What are controlled foreign company rules?** — taxing foreign subsidiary profits before distribution.
14. **How treaty shopping used to work — and why it became harder** — intermediary entities, beneficial ownership, PPT, LOB, substance.
15. **How offshore structures interact with double-tax treaties** — residence, source, withholding, credits, PE, anti-abuse.
16. **How transfer pricing applies to offshore entities** — fees, royalties, loans, arm’s-length pricing, DEMPE.
17. **Why intellectual property is often held offshore** — licensing, royalty streams, IP ownership, substance, BEPS.
18. **How private equity funds use offshore structures** — fund vehicle, GP, LPs, SPVs, blockers, portfolio companies.
19. **Why ships and aircraft are often owned through offshore companies** — finance, registration, liability, leasing, mobility.
20. **How governments detect abusive offshore structures** — UBO registers, CRS, FATCA, exchange of information, CbCR, data matching.

---

# 7. EXISTING / PRIORITY TOPIC DIRECTIONS TO RETAIN

Do not replace the existing bank with only the new ideas above. Continue supporting the previously requested areas, including:

- iron absorption and metabolism
- ferritin / iron deficiency
- glucose vs fructose
- vitamins
- menstrual physiology / luteal phase
- infertility / fertility testing
- collagen
- creatine
- muscle hypertrophy
- anabolic steroids
- dopamine
- neuroplasticity
- focus / attention
- memory consolidation during sleep
- engrams / forgetting
- working memory
- stress
- pain
- addiction
- emotion
- decision-making
- consciousness
- anesthesia
- concussion
- neurodegeneration
- circadian rhythm
- gut-brain axis
- cells / cellular biology
- social media / doomscrolling
- attention residue / task switching
- study methods
- marketing psychology
- bonds
- bond pricing
- index funds
- inflation
- investing
- GDPR
- intellectual property
- AI / neural scaling laws
- Vietnam War
- geopolitics
- current wars
- child protection
- Stoicism
- animal cognition
- chocolate
- Southeast Asian tourism
- scientific experiments / replication

---

## 8. Topic publication rule

A topic should ideally not enter the live feed until it has:

- a strong title
- a concise but useful context explanation
- meaningful takeaways
- credible resources
- **at least one educational video meeting the video-quality rules**
- no Wikipedia links

Where possible, resources should complement each other rather than repeat the same information.

Example:

- one accessible “Start here” video
- one deeper paper/review
- one high-quality article or institutional source
- one book when the topic warrants it

Not every topic needs every resource type.

---

## 9. Suggested topic metadata evolution

The app will benefit from richer metadata as the bank grows.

Possible future structure:

```json
{
  "id": "blood-brain-barrier",
  "title": "The blood-brain barrier: what is allowed into your brain?",
  "subtitle": "Why the brain needs its own controlled chemical environment",
  "category": "Biology",
  "difficulty": "intermediate",
  "context": "...",
  "takeaways": ["..."],
  "tags": ["brain", "neuroscience", "physiology"],
  "relatedTopics": ["neuroinflammation", "drug-delivery"],
  "ressources": {
    "books": [],
    "papers": [],
    "videos": [],
    "articles": []
  }
}
```

Do **not** silently rename the existing `ressources` key unless every dependent part of the code is migrated simultaneously.

---

## 10. Recommended repository-update tasks

When this file is used in the Repository Update Work chat, prioritize the following content/product work:

### Content

1. Merge this new topic bank into the content roadmap.
2. Do not add all topics as shallow shells in one pass.
3. Add them progressively with high-quality context + resources.
4. Ensure every published topic has ≥1 strong video.
5. Continue generating new topics beyond this list; the bank must remain open-ended.
6. Add at least 10 strong new topics per day when doing content-expansion batches.
7. Add a permanent **Why?** discovery category or tag for everyday questions.
8. Preserve broad category diversity so the feed does not become dominated by health/neuroscience.

### Resource curation

9. Remove all remaining Wikipedia resources.
10. Keep code-level Wikipedia blocking.
11. Validate video links before adding them.
12. Prefer the video-selection profile in section 4.
13. Do not over-optimize for university prestige or view count.
14. Track candidate/approved/rejected videos if feasible.

### UI

15. Remove the resource count from the envelope.
16. Remove “resources” wording / unnecessary envelope labels.
17. Preserve one envelope per topic card.
18. Preserve the tactile/editorial design while moving toward a larger continuous feed.
19. Keep the resource paper transparent outside the lace/clip and washed-white rather than cream/yellow.
20. Continue making the app feel handcrafted rather than AI-generated.

### Architecture / scale

21. Keep lazy rendering / batched feed loading as the topic bank grows.
22. Prepare for search, tags/categories, favorites, related topics, difficulty, and saved progress.
23. Avoid rendering hundreds/thousands of topics at once.
24. Keep service-worker caching from serving stale JS/CSS/topic data after updates.

---

## 11. Product test for every future change

Before accepting a new feature, topic, resource, or design element, ask:

> **Does this make Daily Deep Dive feel more like a beautiful, curated intellectual discovery product — or more like generic AI-generated content?**

If it moves toward generic AI output, clutter, low-value engagement tricks, or filler, do not add it.

---

## 12. Content test for every future topic

A good Daily Deep Dive topic should make the user think:

> **“I’ve wondered about this before — now I actually understand how it works.”**

or:

> **“I didn’t know I wanted to understand this, but now I do.”**

That is the core discovery feeling the feed should preserve as it scales.

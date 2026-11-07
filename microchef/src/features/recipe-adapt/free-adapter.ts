/**
 * Adattamento GRATUITO di una ricetta al forno, con regole fisse (nessun LLM).
 *
 * Per ogni passaggio riconosce il tipo di cottura (detect.ts) e lo traduce nelle modalità che il forno
 * possiede davvero, secondo il suo profilo. Le impostazioni prese dal manuale citano la sezione;
 * quelle che vengono da regole di cucina generiche sono marcate "regola_generale"; i casi che il forno
 * o il manuale non coprono sono marcati "non_coperto" invece di essere inventati.
 *
 * Regole usate (documentate anche nel README):
 * - forno tradizionale → modalità convezione alla stessa temperatura e per lo stesso tempo, con preriscaldamento;
 *   in alternativa, se c'è, combinato microonde + convezione con tempo × 0,6 (da verificare);
 * - gratinare → grill, per lo stesso tempo (5 minuti se non indicato);
 * - padella/rosolare → piatto crisp se presente, altrimenti microonde + grill, altrimenti microonde (senza doratura);
 * - stufare/sobbollire → microonde a potenza media-alta, tempo × 0,7, coperto, liquidi −20%;
 * - lessare pasta/riso → microonde massima potenza, tempo × 1,25, ciotola capiente coperta d'acqua;
 *   verdure/patate → microonde massima potenza, tempo × 0,5, coperte con poca acqua;
 * - vapore → recipiente vapore se presente, microonde massima potenza, tempo × 0,8;
 * - microonde con potenza indicata → convertitore di potenza (energia costante);
 * - sciogliere burro/cioccolato → potenza media, a intervalli di 30 secondi;
 * - friggere → non coperto (alternativa: crisp, se presente).
 * Tutti i tempi passano da roundCookingSeconds.
 */
import type { ModeId, OvenProfile } from "@/features/oven-profile/schema";
import { MODE_LABELS } from "@/features/oven-profile/schema";
import { convertPower, formatDuration, pickLevel, roundCookingSeconds, type PowerLevelLike } from "@/features/power-converter/logic";
import { normalize, searchSections, type SearchableSection } from "@/lib/retrieval/bm25";
import { detectStep, guessDishCategory, type DetectedStep } from "./detect";
import type { ParsedRecipe } from "./parse";
import type { AdaptedRecipeData, AdaptedStep } from "./schema";

export const FACTORS = {
  combiConvection: 0.6,
  stew: 0.7,
  pastaBoil: 1.25,
  vegetableBoil: 0.5,
  steam: 0.8,
  panToMicrowave: 0.7,
  liquidReduction: 0.8,
} as const;

const LIQUIDS = /\b(acqua|brodo|vino|latte|panna|birra)\b/i;

interface Ctx {
  profile: OvenProfile;
  sections: SearchableSection[];
  levels: PowerLevelLike[];
  max: PowerLevelLike | null;
}

function mode(ctx: Ctx, id: ModeId) {
  return ctx.profile.modes.find((m) => m.id === id) ?? null;
}

function modeName(m: { id: ModeId; name: string; panelCode: string | null }): string {
  return m.panelCode ? `${m.name} (${m.panelCode})` : m.name || MODE_LABELS[m.id];
}

/**
 * Sezioni del manuale da citare: quella da cui il profilo ha preso la modalità, più al massimo
 * una sezione trovata per parole chiave, ma solo se il suo TITOLO contiene una delle parole cercate
 * (così non si citano sezioni che parlano d'altro).
 */
function sourcesFor(ctx: Ctx, query: string, modeSource: string | null): string[] {
  const terms = new Set(normalize(query));
  const hit = searchSections(ctx.sections, query, 5).find((h) => h.section.slug !== modeSource && normalize(h.section.title).some((t) => terms.has(t)));
  return [...(modeSource ? [modeSource] : []), ...(hit ? [hit.section.slug] : [])];
}

function accessoryFor(ctx: Ctx, id: ModeId, prefer?: RegExp): string | null {
  const allowed = ctx.profile.accessories.filter((a) => a.allowedModes.includes(id) && !a.forbiddenModes.includes(id));
  return (prefer && allowed.find((a) => prefer.test(a.name))?.name) || allowed[0]?.name || null;
}

function microwaveContainer(ctx: Ctx): string {
  const ok = ctx.profile.containerRules.find((r) => r.allowedModes.includes("microwave") && /vetro|ceramica|porcellana/i.test(r.material));
  return ok ? `Contenitore in ${ok.material.toLowerCase()} adatto al microonde` : "Contenitore in vetro o ceramica adatto al microonde";
}

function microwavePauses(seconds: number | null): string[] {
  if (!seconds || seconds < 120) return [];
  return [`Mescola o gira a metà cottura (dopo circa ${formatDuration(roundCookingSeconds(seconds / 2))})`, "Lascia riposare 1-2 minuti prima di servire"];
}

function scaled(d: DetectedStep, factor: number) {
  return {
    durationSeconds: d.seconds ? roundCookingSeconds(d.seconds * factor) : null,
    durationMaxSeconds: d.secondsMax ? roundCookingSeconds(d.secondsMax * factor) : null,
  };
}

function timeText(s: { durationSeconds: number | null; durationMaxSeconds: number | null }, fallback = "il tempo necessario, controllando spesso"): string {
  if (!s.durationSeconds) return fallback;
  return s.durationMaxSeconds ? `${formatDuration(s.durationSeconds)}-${formatDuration(s.durationMaxSeconds)}` : formatDuration(s.durationSeconds);
}

const base = (original: string): AdaptedStep => ({
  instruction: original,
  original,
  mode: null,
  modeLabel: null,
  powerWatts: null,
  powerLabel: null,
  temperatureC: null,
  durationSeconds: null,
  durationMaxSeconds: null,
  accessory: null,
  container: null,
  pauses: [],
  sources: [],
  coverage: "regola_generale",
  note: null,
});

function microwaveStep(ctx: Ctx, original: string, d: DetectedStep, level: PowerLevelLike, factor: number, what: string, extra: Partial<AdaptedStep> = {}): AdaptedStep {
  const mw = mode(ctx, "microwave");
  const t = scaled(d, factor);
  return {
    ...base(original),
    mode: "microwave",
    modeLabel: mw ? modeName(mw) : "Microonde",
    powerWatts: level.watts,
    powerLabel: level.label,
    ...t,
    container: microwaveContainer(ctx),
    pauses: microwavePauses(t.durationSeconds),
    sources: sourcesFor(ctx, `${what} ${original}`, mw?.source ?? null),
    instruction: `${what}: microonde a ${level.label} (${level.watts} W) per ${timeText(t)}.`,
    ...extra,
  };
}

export function adaptStep(ctx: Ctx, original: string): { step: AdaptedStep; reduceLiquids: boolean } {
  const d = detectStep(original);
  const step = base(original);
  if (!ctx.max) return { step: { ...step, coverage: "non_coperto", note: "Il profilo del forno non ha livelli di potenza: completalo per adattare i passaggi." }, reduceLiquids: false };
  const max = ctx.max;
  const near = (w: number) => pickLevel(ctx.levels, w);

  switch (d.method) {
    case "preparazione":
    case "riposo":
      return { step: { ...step, coverage: "regola_generale", note: d.method === "riposo" ? "Passaggio senza forno." : null }, reduceLiquids: false };

    case "forno": {
      const conv = mode(ctx, "convection");
      const combi = mode(ctx, "combi_microwave_convection");
      if (!conv && !combi) {
        return {
          step: { ...step, coverage: "non_coperto", note: "Il tuo forno non ha la modalità convezione: questa cottura in forno non si può replicare fedelmente. Il manuale non indica un'alternativa." },
          reduceLiquids: false,
        };
      }
      const m = conv ?? combi!;
      let temp = d.temperatureC;
      let note: string | null = null;
      if (temp && m.temperatureC) {
        if (temp > m.temperatureC.max) { note = `La ricetta chiede ${temp} °C, ma il forno arriva a ${m.temperatureC.max} °C: imposta il massimo e allunga di qualche minuto, controllando.`; temp = m.temperatureC.max; }
        if (temp < m.temperatureC.min) temp = m.temperatureC.min;
      }
      const t = scaled(d, conv ? 1 : FACTORS.combiConvection);
      const accessory = accessoryFor(ctx, m.id, /basso|inferior|griglia/i);
      const s: AdaptedStep = {
        ...step,
        mode: m.id,
        modeLabel: modeName(m),
        temperatureC: temp,
        ...t,
        accessory,
        container: "Teglia o pirofila adatta al forno (anche metallica in sola convezione)",
        sources: sourcesFor(ctx, "convezione temperatura preriscaldamento", m.source),
        coverage: "manuale",
        pauses: [],
        instruction:
          `${conv ? "" : "Combinato "}${modeName(m)}${temp ? ` a ${temp} °C` : ""} per ${timeText(t, "il tempo indicato dalla ricetta")}` +
          `${conv && m.preheatRequired !== false ? ", dopo aver preriscaldato il forno" : ""}.`,
        note:
          note ??
          (conv && combi
            ? `In alternativa, più veloce: ${modeName(combi)}${temp ? ` a ${temp} °C` : ""} per circa ${timeText(scaled(d, FACTORS.combiConvection), "il 40% di tempo in meno")} (da verificare la prima volta).`
            : conv ? null : "Tempo ridotto del 40% rispetto al forno tradizionale: regola indicativa, controlla la cottura."),
      };
      if (!conv) s.coverage = "regola_generale";
      if (combi && !conv) s.container = "Pirofila in vetro o ceramica (niente metallo: nel combinato ci sono le microonde)";
      return { step: s, reduceLiquids: false };
    }

    case "grill": {
      const g = mode(ctx, "grill") ?? mode(ctx, "combi_microwave_grill");
      if (!g) return { step: { ...step, coverage: "non_coperto", note: "Il forno non ha il grill: non è possibile gratinare." }, reduceLiquids: false };
      const t = d.seconds ? scaled(d, 1) : { durationSeconds: 300, durationMaxSeconds: null };
      return {
        step: {
          ...step,
          mode: g.id,
          modeLabel: modeName(g),
          ...t,
          accessory: accessoryFor(ctx, g.id, /alto|superior|griglia/i),
          container: "Pirofila adatta al grill (niente plastica)",
          sources: sourcesFor(ctx, "grill gratinare dorare", g.source),
          coverage: "manuale",
          instruction: `Gratina con ${modeName(g)} per ${timeText(t)}, controllando che non bruci.`,
        },
        reduceLiquids: false,
      };
    }

    case "padella": {
      const crisp = mode(ctx, "crisp");
      const combiGrill = mode(ctx, "combi_microwave_grill");
      if (crisp) {
        const t = scaled(d, 1);
        return {
          step: {
            ...step,
            mode: "crisp",
            modeLabel: modeName(crisp),
            ...t,
            accessory: accessoryFor(ctx, "crisp", /crisp|doratore|dorat/i),
            sources: sourcesFor(ctx, "doratura crisp piatto doratore rosolare", crisp.source),
            coverage: "manuale",
            pauses: t.durationSeconds && t.durationSeconds >= 120 ? ["Gira gli alimenti a metà cottura"] : [],
            instruction: `Al posto della padella: ${modeName(crisp)} per ${timeText(t)}.`,
          },
          reduceLiquids: false,
        };
      }
      if (combiGrill) {
        const level = near((max.watts * 2) / 3);
        const t = scaled(d, 1);
        return {
          step: {
            ...step,
            mode: "combi_microwave_grill",
            modeLabel: modeName(combiGrill),
            powerWatts: level.watts,
            powerLabel: level.label,
            ...t,
            accessory: accessoryFor(ctx, "combi_microwave_grill", /alto|superior|griglia/i),
            container: "Piatto in vetro o ceramica adatto al grill",
            pauses: t.durationSeconds && t.durationSeconds >= 120 ? ["Gira gli alimenti a metà cottura"] : [],
            sources: sourcesFor(ctx, "microonde grill combinazione", combiGrill.source),
            coverage: "regola_generale",
            instruction: `Al posto della padella: ${modeName(combiGrill)} a ${level.label} (${level.watts} W) per ${timeText(t)}.`,
            note: "Il grill dà un po' di doratura, ma non come la padella.",
          },
          reduceLiquids: false,
        };
      }
      return {
        step: microwaveStep(ctx, original, d, max, FACTORS.panToMicrowave, "Al posto della padella", { note: "Al microonde non si ottiene la rosolatura: il gusto sarà più delicato." }),
        reduceLiquids: true,
      };
    }

    case "stufato": {
      const level = near((max.watts * 2) / 3);
      return {
        step: microwaveStep(ctx, original, d, level, FACTORS.stew, "Cottura lenta", {
          container: `${microwaveContainer(ctx)}, coperto lasciando uno sfiato`,
          note: "Al microonde il liquido evapora meno: i liquidi sono stati ridotti del 20%.",
        }),
        reduceLiquids: true,
      };
    }

    case "bollitura": {
      const starchy = d.food === "pasta" || d.food === "riso";
      return {
        step: microwaveStep(ctx, original, d, max, starchy ? FACTORS.pastaBoil : FACTORS.vegetableBoil, starchy ? `Cottura ${d.food === "pasta" ? "della pasta" : "del riso"}` : "Lessatura", {
          container: starchy
            ? "Ciotola capiente adatta al microonde, con acqua calda salata che copra abbondantemente"
            : "Ciotola adatta al microonde con 3-4 cucchiai d'acqua, coperta lasciando uno sfiato",
          note: starchy ? "Mescola ogni 3-4 minuti; aggiungi acqua calda se si asciuga troppo." : "Le verdure al microonde cuociono più in fretta che in acqua bollente.",
        }),
        reduceLiquids: false,
      };
    }

    case "vapore": {
      const steamAcc = ctx.profile.accessories.find((a) => /vapor/i.test(a.name));
      return {
        step: microwaveStep(ctx, original, d, max, FACTORS.steam, "Cottura a vapore", {
          accessory: steamAcc?.name ?? null,
          container: steamAcc ? null : "Ciotola con 3-4 cucchiai d'acqua, coperta lasciando uno sfiato",
          sources: sourcesFor(ctx, "cottura a vapore recipiente", mode(ctx, "steam")?.source ?? steamAcc?.source ?? null),
          coverage: steamAcc ? "manuale" : "regola_generale",
        }),
        reduceLiquids: false,
      };
    }

    case "microonde": {
      if (d.watts && d.seconds) {
        const r = convertPower({ watts: d.watts, seconds: d.seconds, secondsMax: d.secondsMax }, ctx.levels);
        const mw = mode(ctx, "microwave");
        const t = { durationSeconds: r.seconds, durationMaxSeconds: r.secondsMax };
        return {
          step: {
            ...step,
            mode: "microwave",
            modeLabel: mw ? modeName(mw) : "Microonde",
            powerWatts: r.level.watts,
            powerLabel: r.level.label,
            ...t,
            container: microwaveContainer(ctx),
            pauses: microwavePauses(r.seconds),
            sources: sourcesFor(ctx, "livelli di potenza tempi", mw?.source ?? null),
            coverage: "manuale",
            instruction: `Microonde a ${r.level.label} (${r.level.watts} W) per ${timeText(t)} (convertito da ${d.watts} W).`,
            note: r.warnings[0],
          },
          reduceLiquids: false,
        };
      }
      return { step: microwaveStep(ctx, original, d, max, 1, "Microonde", { coverage: "manuale" }), reduceLiquids: false };
    }

    case "fusione": {
      const level = near(max.watts / 2);
      const t = d.seconds ? scaled(d, 1) : { durationSeconds: 60, durationMaxSeconds: 90 };
      return {
        step: {
          ...microwaveStep(ctx, original, { ...d, seconds: null }, level, 1, "Per sciogliere"),
          ...t,
          pauses: ["Mescola ogni 30 secondi"],
          instruction: `Sciogli al microonde a ${level.label} (${level.watts} W) per ${timeText(t)}, a intervalli di 30 secondi.`,
          sources: sourcesFor(ctx, `fondere ${d.food ?? "burro cioccolato"}`, mode(ctx, "microwave")?.source ?? null),
        },
        reduceLiquids: false,
      };
    }

    case "riscaldamento":
      // tempi da fornello dimezzati; senza tempo indicato si parte da 2 minuti
      return { step: microwaveStep(ctx, original, d.seconds ? d : { ...d, seconds: 240 }, near((max.watts * 2) / 3), 0.5, "Per riscaldare"), reduceLiquids: false };

    case "scongelamento": {
      const def = mode(ctx, "defrost");
      const level = ctx.levels.find((l) => /scongel|defrost/i.test(l.label)) ?? near(max.watts * 0.2);
      return {
        step: microwaveStep(ctx, original, d, level, 1, "Scongelamento", {
          mode: def ? "defrost" : "microwave",
          modeLabel: def ? modeName(def) : "Microonde",
          sources: sourcesFor(ctx, "scongelamento", def?.source ?? null),
          note: "Puoi usare anche il programma automatico di scongelamento del forno, se presente.",
        }),
        reduceLiquids: false,
      };
    }

    case "frittura": {
      const crisp = mode(ctx, "crisp");
      return {
        step: {
          ...step,
          coverage: "non_coperto",
          note: crisp
            ? `Il microonde non può friggere. Alternativa più leggera: ${modeName(crisp)} con un filo d'olio, girando a metà (risultato diverso dalla frittura).`
            : "Il microonde non può friggere e il manuale non indica alternative: questo passaggio va fatto sul fornello.",
          sources: crisp ? sourcesFor(ctx, "doratura crisp", crisp.source) : [],
        },
        reduceLiquids: false,
      };
    }
  }
}

function safetyWarnings(ctx: Ctx, usedModes: Set<ModeId>): AdaptedRecipeData["warnings"] {
  const out: AdaptedRecipeData["warnings"] = [];
  const microwaveUsed = [...usedModes].some((m) => m === "microwave" || m.startsWith("combi") || m === "defrost");
  for (const r of ctx.profile.containerRules) {
    const forbidden = r.forbiddenModes.filter((m) => usedModes.has(m));
    if (forbidden.length) out.push({ text: `Non usare ${r.material.toLowerCase()} in modalità ${forbidden.map((m) => MODE_LABELS[m].toLowerCase()).join(", ")}.${r.note ? ` ${r.note}` : ""}`, source: r.source });
  }
  for (const a of ctx.profile.accessories) {
    const forbidden = a.forbiddenModes.filter((m) => usedModes.has(m));
    if (forbidden.length) out.push({ text: `${a.name}: non usarlo in modalità ${forbidden.map((m) => MODE_LABELS[m].toLowerCase()).join(", ")}.`, source: a.source });
  }
  const relevant = ctx.profile.safetyWarnings.filter((w) => w.category === "materiali" || w.category === "alimenti" || (microwaveUsed && /contenitor|metall|uova|liquid|bollit|coperch/i.test(w.text)));
  out.push(...relevant.slice(0, 4).map((w) => ({ text: w.text, source: w.source })));
  if (microwaveUsed && !out.some((w) => /metall/i.test(w.text))) out.push({ text: "Niente metallo, stagnola o decorazioni dorate nei contenitori quando usi le microonde.", source: null });
  return out;
}

export function adaptRecipeFree(recipe: ParsedRecipe, profile: OvenProfile, sections: SearchableSection[], servings: number): AdaptedRecipeData {
  const levels = [...profile.powerLevels].sort((a, b) => b.watts - a.watts);
  const ctx: Ctx = { profile, sections, levels, max: levels[0] ?? null };

  let reduceLiquids = false;
  const steps = recipe.steps.map((s) => {
    const r = adaptStep(ctx, s);
    reduceLiquids ||= r.reduceLiquids;
    return r.step;
  });

  const ingredients = recipe.ingredients.map((text) => {
    if (reduceLiquids && LIQUIDS.test(text)) {
      return { text, note: "Riduci di circa 1/5: al microonde il liquido evapora meno." };
    }
    return { text, note: null };
  });

  const cooking = steps.filter((s) => s.mode !== null || s.coverage === "non_coperto");
  const uncovered = cooking.filter((s) => s.coverage === "non_coperto");
  const general = cooking.filter((s) => s.coverage === "regola_generale");
  const frying = recipe.steps.some((s) => detectStep(s).method === "frittura");

  let feasibility: AdaptedRecipeData["feasibility"] = "si";
  let reason = "Tutti i passaggi di cottura si possono fare con le modalità del tuo forno, secondo il manuale.";
  if (cooking.length === 0) {
    feasibility = "parziale";
    reason = "Non ho riconosciuto passaggi di cottura nella ricetta: controlla che il testo contenga tempi e modalità (forno, padella, pentola...).";
  } else if (uncovered.length > 0 && (uncovered.length >= cooking.length / 2 || frying)) {
    feasibility = "sconsigliato";
    reason = frying ? "La ricetta prevede una frittura, che il microonde non può fare." : "La maggior parte dei passaggi di cottura non si può fare con questo forno.";
  } else if (uncovered.length > 0 || general.length > 0) {
    feasibility = "parziale";
    reason =
      uncovered.length > 0
        ? `${uncovered.length} passaggio/i non si possono fare con questo forno: vanno fatti in un altro modo.`
        : "Si può fare, ma alcuni passaggi usano regole di cucina generiche e non indicazioni del manuale: controlla la cottura.";
  }

  return {
    title: recipe.title,
    servings,
    dishCategory: guessDishCategory(recipe.title, recipe.ingredients),
    feasibility,
    feasibilityReason: reason,
    ingredients,
    steps,
    warnings: safetyWarnings(ctx, new Set(steps.map((s) => s.mode).filter((m): m is ModeId => m !== null))),
  };
}

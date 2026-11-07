import { describe, expect, it } from "vitest";
import { extractRecipeFromHtml, parseRecipeText, parseServings, recipeToText, splitSentences } from "../parse";

const TEXT = `Pasta al forno
Dosi per 4 persone
Ingredienti
- 320 g di pasta
- 400 g di passata di pomodoro
- 150 g di mozzarella
- Sale q.b.
Procedimento
1. Cuoci la pasta in abbondante acqua salata per 8 minuti.
2. Condiscila con la passata e metà della mozzarella.
3. Inforna a 200 °C per 20 minuti.`;

describe("parseRecipeText", () => {
  it("riconosce titolo, porzioni, ingredienti e passaggi", () => {
    const r = parseRecipeText(TEXT);
    expect(r.title).toBe("Pasta al forno");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toEqual(["320 g di pasta", "400 g di passata di pomodoro", "150 g di mozzarella", "Sale q.b."]);
    expect(r.steps).toHaveLength(3);
    expect(r.steps[2]).toBe("Inforna a 200 °C per 20 minuti.");
  });

  it("funziona anche senza intestazioni", () => {
    const r = parseRecipeText("Torta veloce\n200 g di farina\n3 uova\nMescola tutto e cuoci in forno a 180 gradi per 35 minuti.");
    expect(r.ingredients).toEqual(["200 g di farina", "3 uova"]);
    expect(r.steps).toEqual(["Mescola tutto e cuoci in forno a 180 gradi per 35 minuti."]);
  });

  it("divide i paragrafi lunghi in passaggi", () => {
    const long = "Taglia le verdure a cubetti e mettile in una ciotola capiente con olio e sale. ".repeat(3) + "Cuoci in padella per 10 minuti a fuoco medio, mescolando spesso. Servi caldo.";
    const r = parseRecipeText(`Verdure\nProcedimento\n${long}`);
    expect(r.steps.length).toBeGreaterThan(1);
  });
});

describe("parseServings e splitSentences", () => {
  it("legge le porzioni in vari formati", () => {
    expect(parseServings("Porzioni: 6")).toBe(6);
    expect(parseServings("per 2 persone")).toBe(2);
    expect(parseServings("niente")).toBeNull();
  });
  it("raggruppa le frasi brevi", () => {
    expect(splitSentences("Accendi. Mescola bene il tutto per due minuti.")).toEqual(["Accendi. Mescola bene il tutto per due minuti."]);
  });
});

describe("extractRecipeFromHtml", () => {
  it("usa i dati strutturati schema.org (anche dentro @graph)", () => {
    const html = `<html><head><title>Sito</title><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        {
          "@type": "Recipe",
          name: "Risotto &amp; zucca",
          recipeYield: ["4", "4 porzioni"],
          recipeIngredient: ["320 g riso", "500 g zucca"],
          recipeInstructions: [{ "@type": "HowToStep", text: "Tosta il riso." }, { "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Cuoci per 18 minuti." }] }],
        },
      ],
    })}</script></head><body></body></html>`;
    const { recipe, structured } = extractRecipeFromHtml(html);
    expect(structured).toBe(true);
    expect(recipe).toEqual({ title: "Risotto & zucca", servings: 4, ingredients: ["320 g riso", "500 g zucca"], steps: ["Tosta il riso.", "Cuoci per 18 minuti."] });
  });

  it("in mancanza di dati strutturati legge il testo dell'articolo", () => {
    const html = `<html><head><title>Frittata</title></head><body><nav>menu</nav><article><h2>Ingredienti</h2><ul><li>4 uova</li><li>50 g di parmigiano</li></ul><h2>Preparazione</h2><p>Sbatti le uova e cuoci in padella per 5 minuti.</p></article></body></html>`;
    const { recipe, structured } = extractRecipeFromHtml(html);
    expect(structured).toBe(false);
    expect(recipe.title).toBe("Frittata");
    expect(recipe.ingredients).toEqual(["4 uova", "50 g di parmigiano"]);
    expect(recipe.steps).toEqual(["Sbatti le uova e cuoci in padella per 5 minuti."]);
  });
});

describe("recipeToText", () => {
  it("ricompone un testo leggibile e rileggibile", () => {
    const r = parseRecipeText(TEXT);
    expect(parseRecipeText(recipeToText(r))).toEqual(r);
  });
});

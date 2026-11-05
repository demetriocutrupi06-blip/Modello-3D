# GraHeaL: prompt iper-realistici per generatori di immagini e modelli 3D

Prompt pronti all'uso per Midjourney, DALL·E, Stable Diffusion/Flux, Firefly, Meshy, Tripo, Rodin o simili.
Sono in inglese perché i generatori seguono meglio l'inglese. Ogni prompt ha un **negative prompt** facoltativo.
Le parti tra `[...]` si possono cambiare (per esempio PLA ↔ cellulosa).

---

## 1. Scena principale: lettore + cartuccia (hero shot)

```text
Ultra-photorealistic industrial design product render of "GraHeaL", a handheld point-of-care
diagnostic reader for bedside use, with a disposable graphene biosensor cartridge inserted.
Reader: compact palm-sized device, approx. 120 x 64 x 26 mm, soft rounded rectangle body in
glossy medical-grade white polycarbonate with satin clearcoat, a thin dark graphite elastomer
band running around the waistline, a precision cartridge slot cut into the band on the short
front face with a dark anthracite bezel and a small gold index mark above it. Top surface:
inset black glass display showing a live amber and red differential signal curve and the
word "GraHeaL", a round brushed-gold start button, a tiny blue Bluetooth Low Energy status LED
lens glowing softly next to a printed BLE glyph. A USB-C port with a polished steel rim is
visible on the rear face.
Cartridge: a thin flexible translucent [amber PLA | off-white cellulose] biopolymer strip
protruding from the slot, with gold Au/Cr electrode traces and contact pads, two small
rectangular dark graphene channels side by side (one active, one bluish passivated reference),
a clear microfluidic lid and a round sample port holding a single glossy bead of blood.
Clinical environment: placed on a white hospital bedside table, softly blurred hospital
room background, morning window light, large softbox key light from upper left, subtle rim
light, realistic contact shadows, shallow depth of field, 100 mm macro product photography,
f/5.6, ISO 100, physically based materials, 8K, Octane / Keyshot render quality.
```

**Negative prompt:** `cartoon, toy, low poly, smartphone, glucometer branding, logos of real companies, text errors, extra slots, warped geometry, blurry, oversaturated, fingerprints, dust`

---

## 2. Cartuccia monouso (macro, chip flesso)

```text
Macro photograph of a disposable flexible biosensor chip, 40 x 14 mm, made of a thin
transparent [amber PLA | white cellulose paper-like] biopolymer film gently bent in an arc
to show its flexibility (replacing a rigid silicon wafer). On its surface, precisely
patterned thin-film electrodes in gold over a chromium adhesion layer (Au/Cr): six contact
pads along the insertion edge, fine gold traces leading to two identical graphene
field-effect transistors (GFET) placed side by side as a differential pair. Each GFET has a
Source pad, a Drain pad and a coplanar Gate strip, with a dark iridescent monolayer graphene
channel between source and drain showing a faint hexagonal honeycomb texture. The upper
channel is "active / functionalized" with a subtle speckled bio-coating; the lower channel
is the "reference", covered by a thin translucent bluish passivation layer. A clear
microfluidic lid covers the channels; a raised round sample inlet funnel holds one glossy
dark-red drop of blood that splits into a Y-shaped channel feeding both GFET chambers.
Small printed marks: "ACT", "REF", an insertion arrow, a blood-drop icon, "GraHeaL".
Studio macro lighting, white seamless background, crisp specular highlights on gold,
100 mm macro lens, focus stacking, hyper-detailed, photorealistic, 8K.
```

**Negative prompt:** `silicon wafer, rigid PCB, green solder mask on the chip, copper color electrodes, more than two channels, messy blood smear, bubbles, illegible text`

---

## 3. Spaccato del lettore (cutaway tecnico)

```text
Hyper-realistic technical cutaway render of a handheld medical point-of-care reader, front
half of the white polycarbonate housing sliced away with a clean section plane painted in
warm gold, revealing the internal electronics: a dark green PCB carrying a black QFN
System-on-Chip microcontroller with integrated Bluetooth Low Energy radio (laser-marked
"SoC MCU / BLE 5.3"), a separate blue daughter-board Digital Signal Processing module under
an open steel RF shield frame (laser-marked "DSP / LOCK-IN AMP / FIR IIR FILTER") used for
signal filtering and lock-in amplification, a small analog front-end chip ("AFE TIA/POT"
for amperometric and potentiometric readout), a meandered 2.4 GHz PCB antenna, a silver
Li-Po pouch battery, a USB-C receptacle at the rear edge, a clear acrylic light pipe from a
blue SMD LED up to the status lens, and at the front a precision cartridge connector with
smoked transparent cover and six gold spring contacts pressing on the gold pads of the
inserted flexible biopolymer chip. Isometric 3/4 view from above, neutral light grey
studio background, soft global illumination, ambient occlusion, engineering visualization
style, photoreal PBR materials, 8K.
```

**Negative prompt:** `exploded chaos, floating random parts, wires everywhere, heatsinks, fans, desktop computer motherboard, wrong scale, cartoon`

---

## 4. Zoom nanoscopico (canale GFET attivo)

```text
Scientific molecular visualization, photoreal ball-and-stick rendering, of the surface of a
graphene field-effect transistor biosensor channel: a perfectly flat monolayer of pristine
graphene shown as a hexagonal honeycomb lattice of dark grey carbon atoms (C–C bond 0.142 nm),
lying on a translucent biopolymer substrate, with gold electrode blocks on a thin chromium
layer at both edges. On the graphene, several PBASE linker molecules
(1-pyrenebutanoic acid succinimidyl ester): the flat four-ring pyrene group lies parallel to
the lattice at 0.34 nm (π–π stacking), a short butyric chain rises up; some linkers still end
with the five-membered NHS ester ring (red oxygens, blue nitrogen), others are covalently
coupled through an amide bond to ultra-compact single-stranded DNA/RNA aptamers folded as
tiny stem-loop hairpins smaller than 2 nm, with orange phosphate backbone and colored
nucleobases. One aptamer has captured a small violet biomarker molecule in its loop; larger
violet protein biomarkers float above in the plasma. Include a thin gold dimension bar
labeled "< 2 nm" next to one aptamer and a "1 nm" scale bar on the lattice. Clean light
background, soft depth of field, subsurface scattering on biomolecules, cinematic lighting,
scientific journal cover quality, 8K.
```

**Negative prompt:** `double-helix long DNA, antibodies (Y-shaped), cartoon icons, wrong hexagons, pentagons in graphene lattice, cluttered, text artifacts`

---

## 5. Esploso a strati della cartuccia

```text
Exploded-view product render of a flexible disposable biosensor cartridge, layers separated
vertically and perfectly aligned, from bottom to top: (1) translucent flexible biopolymer
substrate film [PLA | cellulose] with fine print, (2) two small monolayer graphene channels
with honeycomb texture, (3) chromium adhesion layer pattern (silver), (4) gold electrode
pattern with Source, Drain and Gate for two GFETs and six contact pads, (5) bio-layer:
speckled PBASE + aptamer coating on the active channel and a bluish passivation patch on the
reference channel, (6) a red blood film shaped as a Y microfluidic path with two chambers,
(7) clear microfluidic lid with a round inlet funnel and a single drop of blood above it.
Thin dashed alignment lines between layers, white background, soft shadows, technical
product visualization, photoreal, 8K.
```

---

## 6. Prompt per generatori text-to-3D (Meshy, Tripo, Rodin)

Usarli **separatamente** (un oggetto per prompt) per ottenere mesh pulite:

```text
Handheld medical diagnostic reader, rounded rectangular body 120x64x26 mm, glossy white
plastic, dark grey rubber band around the middle, narrow horizontal cartridge slot on the
front short side, black glass screen on top, round gold button, small blue LED, USB-C port on
the back. Clean hard-surface product model, quad topology, PBR textures.
```

```text
Thin flexible plastic biosensor strip 40x14x0.25 mm, slightly curved, gold electrode traces
and six gold contact pads at one end, two small dark square sensor areas in the middle,
transparent cover with a round sample port at the other end. Hard-surface, PBR, clean UVs.
```

---

### Consigli

- **Midjourney:** aggiungere `--ar 16:9 --style raw --s 150 --v 7` (o la versione corrente).
- **Stable Diffusion / Flux:** CFG 5–7, 30–40 step; per i testi stampati usare inpainting o
  aggiungerli in post.
- I generatori sbagliano spesso le scritte: tenere i testi brevi (GraHeaL, ACT, REF) o
  rimuoverli e applicarli dopo.
- Per una resa coerente con il modello 3D interattivo di questo repository, esportare il `.glb`
  da `index.html` e usarlo come riferimento di forma (image-to-image / depth ControlNet).

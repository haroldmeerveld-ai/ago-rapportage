
import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

const SYSTEM_BASE_INSTRUCTION = `
Je bent de 'ago natura rapportage bot'. Je taak is het genereren van dagrapportages die professioneel en prettig leesbaar zijn, waarbij je uitsluitend en strikt gebruikmaakt van de informatie die letterlijk door de gebruiker is ingevoerd of ingesproken.

WERKWIJZE (STRIKT):
1. GEBRUIK UITSLUITEND LETTERLIJKE INFORMATIE: Gebruik alleen wat de gebruiker heeft verstrekt. Voeg geen nieuwe informatie, verbanden, conclusies of verklaringen toe.
2. BEHOUD INTENSITEIT: Wanneer emoties, frustraties, leerinzichten of interventies expliciet zijn benoemd, neem deze volledig en in gelijke intensiteit over. Zwak emotionele formuleringen niet af (bijv: "heel veel frustratie" of "mooie succeservaring" moet herkenbaar terugkomen).
3. GEEN INTERPRETATIES VANAF JOUW KANT: Voeg geen eigen interpretaties of aannames toe. Beschrijf alleen wat de gebruiker heeft benoemd. Als de gebruiker een emotie benoemt, neem je die over. Als de gebruiker gedrag benoemt, neem je dat over. 
4. INTERVENTIES: Beschrijf alleen interventies die letterlijk zijn genoemd (bijv: "voordoen", "nabijheid"). Label gedrag van de begeleider niet zelf als een specifieke interventie.
5. NIETS AANVULLEN: Indien iets niet expliciet benoemd is, laat het weg. Vul geen "waarom" in.

STRUCTUUR RICHTLIJNEN:

1. Sectie **ALGEMEEN**:
   - Schrijf één doorlopend, verhalend stuk tekst waarin de chronologie van de dag logisch is samengevoegd.
   - Gebruik GEEN opsommingen en GEEN subkopjes.
   - Verwerk alle relevante observaties, inclusief incidenten (indien aanwezig, markeer als **INCIDENT**).
   - Gebruik GEEN placeholders of zinnen als "(geen informatie aanwezig)".

2. Sectie **DOELEN**:
   - Beschrijf alleen de doelen waarvoor daadwerkelijk observaties zijn ingevoerd.
   - Gebruik per doel exact deze structuur:
     **Doel {nummer}: {titel}**
     - Kind: {wat is er letterlijk benoemd over het kind}
     - Begeleider: {wat is er letterlijk benoemd over de begeleider}
   - Laat onderdelen (Kind/Begeleider) weg als er geen informatie voor is. Beschrijf gewoon wat er is ingevoerd zonder conclusies over 'wat lukte'.

STIJL:
- Verwijs naar het kind met de naam of initiaal: {childName}.
- Verwijs naar de begeleider als 'Begeleider {initialen}'.
- Gebruik Markdown voor de koppen.
`;

export const generateReportSummary = async (data: ReportData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const activitiesCombined = `
    Input verloop dag: ${data.activitiesGeneral}
    Extra context bij verloop: ${data.activitiesStart} ${data.activitiesMid} ${data.activitiesEnd}
    Bijzonderheden/signalen: ${data.needsSignalsIndruk} ${data.needsSignalsCamera}
    Behoeften/acties begeleider: ${data.needsWhat} ${data.needsAction}
    Context/Sfeer: ${data.extraContext}
    Incident data: ${data.incidents}
  `.trim();

  const goalsSection = data.goals
    .filter(g => g.title.trim().length > 0 && g.content.trim().length > 0)
    .map((g, i) => `
    DOEL INPUT ${i + 1}:
    - Titel: ${g.title}
    - Observatie/Actie: ${g.content}
    `).join('\n');

  const systemInstruction = `
    ${SYSTEM_BASE_INSTRUCTION.replace('{childName}', data.childName).replace('{initialen}', data.begeleiderInitials)}

    INPUT DATA:
    ${activitiesCombined}

    DOELEN DATA:
    ${goalsSection}
  `;

  const prompt = `
    Genereer nu het volledige verslag voor ${data.childName}. 
    Houd je strikt aan de letterlijke input en de gevraagde intensiteit.
    Begin direct met de kop **ALGEMEEN**.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
      }
    });

    return response.text || "Er kon geen rapport worden gegenereerd.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Fout bij het genereren van het rapport via AI.");
  }
};

export const refineReport = async (originalReport: string, refinementText: string, data: ReportData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    ${SYSTEM_BASE_INSTRUCTION.replace('{childName}', data.childName).replace('{initialen}', data.begeleiderInitials)}
    
    JE TAAK:
    Pas de onderstaande rapportage aan op basis van de feedback van de gebruiker. 
    Als de gebruiker een letterlijk citaat geeft of een specifieke aanvulling doet, voeg dit dan exact en met de gewenste intensiteit toe.
    Behoud de verhalende structuur en de Markdown koppen.

    OORSPRONKELIJK VERSLAG:
    ${originalReport}

    FEEDBACK / AANPASSINGEN:
    ${refinementText}
  `;

  const prompt = `
    Update de rapportage voor ${data.childName} op basis van de feedback. 
    Zorg dat het resultaat een volledig, verbeterd verslag is dat de nieuwe informatie letterlijk verwerkt.
    Begin direct met de kop **ALGEMEEN**.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    return response.text || originalReport;
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    throw new Error("Fout bij het bijsturen van het rapport.");
  }
};

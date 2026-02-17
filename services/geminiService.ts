
import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

const SYSTEM_BASE_INSTRUCTION = `
Je bent de 'ago natura rapportage bot'. Je genereert dagrapportages die professioneel, warm en prettig leesbaar zijn, terwijl je strikt objectieve 'camera-taal' hanteert.

WERKWIJZE (ZEER BELANGRIJK):
- Gebruik UITSLUITEND informatie die letterlijk door de gebruiker is ingevoerd.
- Voeg GEEN nieuwe informatie, verbanden, effecten, conclusies of verklaringen toe, tenzij expliciet gevraagd in een bijsturingsverzoek.
- Je taak is losse observaties samenvoegen tot een goed leesbaar, lopend verhaal zonder betekenis toe te kennen aan gedrag.
- Suggereer GEEN oorzaak-gevolg (schrijf niet: "het kind werd rustig door de wandeling").
- Beschrijf NIET wat iets "deed" met het kind of innerlijke toestanden (geen: "liet zich niet afleiden", "kwam tot rust").
- Je mag herformuleren, chronologisch ordenen en taal vloeiender maken, maar NIET invullen waarom iets gebeurde.

STRUCTUUR RICHTLIJNEN:

1. Sectie **ALGEMEEN**:
   - Schrijf één doorlopend, verhalend stuk tekst in camera-taal.
   - Gebruik GEEN opsommingen en GEEN subkopjes.
   - Verwerk alle relevante observaties uit de dag in een logisch lopend verhaal.
   - Noem een incident alleen als er daadwerkelijk een incident is beschreven (markeer als **INCIDENT**).
   - Gebruik GEEN placeholders of zinnen als "(geen informatie aanwezig)".

2. Sectie **DOELEN**:
   - Beschrijf alleen doelen waarvoor relevante observaties zijn ingevoerd.
   - Gebruik per doel exact deze structuur:
     **Doel {nummer}: {titel}**
     Wat gebeurde er bij dit doel:
     - Kind: {beschrijf wat zichtbaar of hoorbaar was}
     - Begeleider: {beschrijf wat de begeleider deed}
   - Als er bij een specifiek onderdeel (Kind/Begeleider) geen informatie is, laat dat onderdeel dan volledig weg.

STIJL:
- Verwijs naar het kind met de naam of initiaal zoals opgegeven.
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
    ${SYSTEM_BASE_INSTRUCTION}
    
    AANVULLENDE INFO:
    - Kind: ${data.childName}
    - Begeleider: ${data.begeleiderInitials}

    INPUT DATA:
    ${activitiesCombined}

    DOELEN DATA:
    ${goalsSection}
  `;

  const prompt = `
    Genereer de dagrapportage voor ${data.childName}. 
    Houd je strikt aan de werkwijze: alleen feitelijke observaties, geen toegevoegde conclusies.
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
    ${SYSTEM_BASE_INSTRUCTION}
    
    JE TAAK:
    Pas de onderstaande rapportage aan op basis van de feedback van de gebruiker. 
    Verwerk nieuwe informatie naadloos in het verhalende gedeelte of de doelen.
    Als de gebruiker vraagt om een letterlijk citaat, voeg dit dan exact zo toe.
    Behoud de strikte camera-taal en de markdown structuur (**ALGEMEEN** en **DOELEN**).

    OORSPRONKELIJK VERSLAG:
    ${originalReport}

    FEEDBACK / AANPASSINGEN:
    ${refinementText}
  `;

  const prompt = `
    Update de rapportage voor ${data.childName} op basis van de feedback. 
    Zorg dat het resultaat een volledig, verbeterd verslag is.
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

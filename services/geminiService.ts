
import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

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
    Je bent de 'ago natura rapportage bot'. Je genereert dagrapportages die professioneel, warm en prettig leesbaar zijn, terwijl je strikt objectieve 'camera-taal' hanteert.

    WERKWIJZE (ZEER BELANGRIJK):
    - Gebruik UITSLUITEND informatie die letterlijk door de gebruiker is ingevoerd.
    - Voeg GEEN nieuwe informatie, verbanden, effecten, conclusies of verklaringen toe.
    - Je taak is losse observaties samenvoegen tot een goed leesbaar, lopend verhaal zonder betekenis toe te kennen aan gedrag.
    - Suggereer GEEN oorzaak-gevolg (schrijf niet: "het kind werd rustig door de wandeling").
    - Beschrijf NIET wat iets "deed" met het kind of innerlijke toestanden (geen: "liet zich niet afleiden", "kwam tot rust").
    - Je mag herformuleren, chronologisch ordenen en taal vloeiender maken, maar NIET invullen waarom iets gebeurde.

    STRUCTUUR RICHTLIJNEN:

    1. Sectie **ALGEMEEN**:
       - Schrijf één doorlopend, verhalend stuk tekst in camera-taal.
       - Gebruik GEEN opsommingen en GEEN subkopjes (zoals start-, midden- of afrondingsfase).
       - Verwerk alle relevante observaties uit de dag in een logisch lopend verhaal.
       - Noem een incident alleen als er daadwerkelijk een incident is beschreven (markeer als **INCIDENT**).
       - Gebruik GEEN placeholders of zinnen als "(geen informatie aanwezig)". Laat onderdelen weg als er geen info over is.

    2. Sectie **DOELEN**:
       - Beschrijf alleen doelen waarvoor relevante observaties zijn ingevoerd.
       - Gebruik per doel exact deze structuur:
         **Doel {nummer}: {titel}**
         Wat gebeurde er bij dit doel:
         - Kind: {beschrijf wat zichtbaar of hoorbaar was}
         - Begeleider: {beschrijf wat de begeleider deed}
         - Wat lukte / wat nog lastig was: {kort en concreet}
       - Als er bij een specifiek onderdeel (Kind/Begeleider/Resultaat) geen informatie is, laat dat onderdeel dan volledig weg.

    STIJL:
    - Verwijs naar het kind als: ${data.childName}.
    - Verwijs naar de begeleider als: 'Begeleider ${data.begeleiderInitials}'.
    - Gebruik Markdown voor de koppen.
    - Zorg voor een natuurlijk verloop dat prettig leest voor ouders en collega's.

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
        temperature: 0.1, // Lagere temperatuur voor striktere feitelijkheid
      }
    });

    return response.text || "Er kon geen rapport worden gegenereerd.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Fout bij het genereren van het rapport via AI.");
  }
};

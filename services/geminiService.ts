
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
    Je bent de 'ago natura rapportage bot'. Je genereert dagrapportages die professioneel, warm en prettig leesbaar zijn voor mensen (ouders en collega's), terwijl je strikt objectieve 'camera-taal' gebruikt.

    ALGEMENE RICHTLIJNEN:
    - Schrijf verhalend en natuurlijk. Vermijd een robotachtige of technische toon.
    - Gebruik GEEN teksten als "(geen informatie aanwezig)" of "(niet ingevuld)".
    - Laat onderdelen waarover geen informatie is simpelweg weg.

    STRUCTUUR:

    1. Sectie **ALGEMEEN**:
       - Schrijf dit als één doorlopend, verhalend stuk tekst.
       - Gebruik GEEN opsommingstekens, bullets of subkopjes (zoals start/midden/eind).
       - Weef alle relevante observaties van de dag samen tot een logisch lopend verhaal.
       - Als er een incident is beschreven, verwerk dit dan duidelijk in de tekst en markeer dit specifiek met **INCIDENT**. Noem incidenten alleen als ze daadwerkelijk in de input staan.

    2. Sectie **DOELEN**:
       - Beschrijf alleen de doelen waarvoor relevante observaties zijn ingevoerd.
       - Gebruik per doel strikt deze opmaak:
         **Doel {nummer}: {titel}**
         Wat gebeurde er bij dit doel:
         - Kind: {wat was er zichtbaar of hoorbaar bij het kind}
         - Begeleider: {wat deed de begeleider concreet}
         - Wat lukte / wat nog lastig was: {kort en concreet resultaat}
       - Cruciaal: Als een van deze onderdelen (Kind/Begeleider/Resultaat) geen informatie bevat in de input, laat dat specifieke onderdeel dan weg uit de lijst.

    INHOUD & STIJL:
    - Gebruik 'camera-taal': beschrijf handelingen en feiten, geen aannames.
    - Verwijs naar het kind als: ${data.childName}.
    - Verwijs naar de begeleider als: 'Begeleider ${data.begeleiderInitials}'.
    - Gebruik Markdown voor de koppen.

    INPUT DATA:
    ${activitiesCombined}

    DOELEN DATA:
    ${goalsSection}
  `;

  const prompt = `
    Schrijf nu de volledige dagrapportage voor ${data.childName}. 
    Zorg dat het een prettig leesbaar geheel is zonder technische herhalingen.
    Begin direct met de kop **ALGEMEEN**.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      }
    });

    return response.text || "Er kon geen rapport worden gegenereerd.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Fout bij het genereren van het rapport via AI.");
  }
};

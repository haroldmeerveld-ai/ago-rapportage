
import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

export const generateReportSummary = async (data: ReportData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const activitiesCombined = `
    Chronologisch verloop: ${data.activitiesGeneral}
    Start-fase: ${data.activitiesStart}
    Midden-fase: ${data.activitiesMid}
    Afronding: ${data.activitiesEnd}
    Bijzonderheden/behoeften: ${data.needsSignalsIndruk} ${data.needsSignalsCamera}
    Acties begeleider: ${data.needsAction}
    Context: ${data.extraContext}
    Incident (indien van toepassing): ${data.incidents}
  `.trim();

  const goalsSection = data.goals
    .filter(g => g.title.trim().length > 0)
    .map((g, i) => `
    DOEL ${i + 1} INPUT:
    - Titel: ${g.title}
    - Observatie: ${g.content}
    `).join('\n');

  const systemInstruction = `
    Je bent de 'ago natura rapportage bot'. Je genereert dagrapportages volgens een strikt format en een feitelijke 'camera-taal' (geen interpretaties, geen 'waarom', geen verklaringen).

    RICHTLIJNEN VOOR DE STRUCTUUR:
    1. Begin ALTIJD met de sectie **ALGEMEEN**.
    2. Daarna volgt de sectie **DOELEN**.
    3. Elk doel krijgt een eigen sub-sectie in het formaat: **Doel {nummer}: {titel}**.
    4. Gebruik voor elk doel exact deze indeling:
       Wat gebeurde er bij dit doel:
       - Kind: {wat het kind deed of liet zien}
       - Begeleider: {wat de begeleider deed}
       - Wat lukte / wat nog lastig was: {kort en concreet}
    5. Geen extra secties toevoegen buiten **ALGEMEEN** en **DOELEN**.

    RICHTLIJNEN VOOR INHOUD:
    - Gebruik feitelijke camera-taal: beschrijf enkel wat zichtbaar of hoorbaar was.
    - Gebruik voor het kind de naam of initiaal: ${data.childName}.
    - De begeleider is 'Begeleider ${data.begeleiderInitials}'.
    - Als een incident is ingevoerd, verwerk dit feitelijk binnen de sectie **ALGEMEEN**.
    - Gebruik witregels tussen de secties.
    - Gebruik markdown. Kopjes moeten **vetgedrukt** zijn.

    INPUT DATA:
    - Verloop van de dag: ${activitiesCombined}
    - Doelen informatie:
    ${goalsSection}
  `;

  const prompt = `
    Genereer de eindrapportage voor ${data.childName} op basis van de instructies.
    Start direct met **ALGEMEEN**, gevolgd door de doelen onder de kop **DOELEN**.
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

import { GoogleGenAI } from "@google/genai";
import { ReportData } from "../types";

export const generateReportSummary = async (
  data: ReportData
): Promise<string> => {

  // ✅ Vite leest ALLEEN env vars die met VITE_ beginnen
  

  const ai = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      apiVersion: "v1", // ✅ GEEN beta
    },
  });

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

  const goalsSection = (data.goals || [])
    .filter((g) => (g.title || "").trim().length > 0)
    .map((g, i) => `
**Doel ${i + 1}: ${g.title?.trim()}**

Wat gebeurde er bij dit doel:
- Kind: ${(g.child || "").trim()}
- Begeleider: ${(g.guide || "").trim()}
- Wat lukte / wat nog lastig was: ${(g.success || "").trim()}
`.trim())
    .join("\n\n");

  const systemInstruction = `
Je schrijft een AGO-rapportage in het Nederlands.

REGELS:
- Gebruik camera-taal (feitelijk, zichtbaar/hoorbaar)
- Geen verklaringen of interpretaties
- Structuur exact volgen

STRUCTUUR:
**ALGEMEEN**
(paragraaf)

**DOELEN**
(elk doel apart, met kopje)
`.trim();

  const prompt = `
**ALGEMEEN**
${activitiesCombined}

**DOELEN**
${goalsSection}
`.trim();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.1,
    },
  });

  return (response.text || "").trim();
};

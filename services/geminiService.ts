import { ReportData } from "../types";

export const generateReportSummary = async (
  data: ReportData
): Promise<string> => {
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

  const prompt = `
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

**ALGEMEEN**
${activitiesCombined}

**DOELEN**
${goalsSection}
`.trim();

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  const dataRes = await response.json();

  const text =
    dataRes?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    throw new Error("Geen antwoord van AI ontvangen.");
  }

  return text.trim();
};


import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { StepIndicator } from './components/StepIndicator';
import { WIZARD_STEPS, INITIAL_DATA, CHILD_NAME_SUGGESTIONS, INITIALS_SUGGESTIONS } from './constants';
import { ReportData, GoalEntry } from './types';
import { generateReportSummary } from './services/geminiService';

// Structured validation logic for 'soft_flag_with_learning'
interface ValidationResult {
  category: 'diagnosis' | 'intention' | 'interpretation';
  flaggedWords: string[];
}

const SIGNAL_SUGGESTIONS = [
  "gefrustreerd", "boos", "gespannen", "onrustig", "afwachtend", "vermijdend", "overprikkeld", "overweldigd", "vrolijk", "enthousiast", "moe", "teruggetrokken"
];

const VALIDATION_CATEGORIES = {
  interpretation: {
    pattern: /\b(overprikkeld|gezellig|ontspannen|lastig|druk|humeurig)\b/i,
    message: "Let op – dit is een interpretatie.",
    tip: "In deze rapportage beschrijven we wat zichtbaar of hoorbaar was.",
    suggestions: [
      "Het kind liep meerdere keren weg en keek om zich heen.",
      "Het kind maakte veel bewegingen en praatte hard.",
      "Het kind reageerde niet op aanspreken en vroeg om een pauze."
    ]
  },
  diagnosis: {
    pattern: /\b(depressie|autisme|autistisch|adhd|trauma|ptss|hechtingsstoornis)\b/i,
    message: "Let op – dit is een diagnose of label.",
    tip: "Gebruik geen medische termen in deze rapportage.",
    suggestions: [
      "Het kind was stil en keek veel naar de grond.",
      "Het kind gaf korte antwoorden en nam weinig initiatief.",
      "Het kind trok zich terug en bleef apart zitten."
    ]
  },
  intention: {
    pattern: /\b(wilde niet|had geen zin|deed expres|zocht grenzen op)\b/i,
    message: "Let op – dit beschrijft wat je denkt dat het kind wilde.",
    tip: "Beschrijf wat je zag of hoorde.",
    suggestions: [
      "Het kind zei \"nee\" en deed niet mee.",
      "Het kind keek toe maar pakte het materiaal niet.",
      "Het kind liep weg van de activiteit en bleef in zicht."
    ]
  }
};

const getValidationResults = (text: string, isIndrukField: boolean = false): ValidationResult[] => {
  if (text.trim().length < 4) return [];
  const results: ValidationResult[] = [];
  
  Object.entries(VALIDATION_CATEGORIES).forEach(([key, config]) => {
    const match = text.match(new RegExp(config.pattern, 'gi'));
    if (match) {
      let filteredWords = Array.from(new Set(match));
      
      // IF field is "Signalen - indruk", do not trigger interpretation flag for pre-defined choices
      if (isIndrukField && key === 'interpretation') {
        filteredWords = filteredWords.filter(word => 
          !SIGNAL_SUGGESTIONS.some(suggestion => suggestion.toLowerCase() === word.toLowerCase())
        );
      }
      
      if (filteredWords.length > 0) {
        results.push({
          category: key as any,
          flaggedWords: filteredWords
        });
      }
    }
  });
  
  return results;
};

// Programmatic splitting of activity text
const splitTimeline = (text: string) => {
  const startSplit = text.split(/daarna|vervolgens/i);
  const start = startSplit[0] || "";
  const midEndPart = text.slice(start.length).replace(/^(daarna|vervolgens)/i, '').trim();
  const endSplit = midEndPart.split(/aan het einde|tot slot/i);
  const verloop = endSplit[0] || "";
  const afronding = midEndPart.slice(verloop.length).replace(/^(aan het einde|tot slot)/i, '').trim();
  
  return {
    start: start.trim(),
    mid: verloop.trim(),
    end: afronding.trim()
  };
};

// Speech recognition type definitions
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: { transcript: string; };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

const NEEDS_SUGGESTIONS = [
  "Nabijheid / steun",
  "Rust / pauze",
  "Duidelijkheid / voorspelbaarheid",
  "Structuur / overzicht",
  "Bevestiging / geruststelling",
  "Autonomie / zelf kiezen",
  "Begrenzing",
  "Tijd (vertragen / wachten)",
  "Afleiding / iets anders doen"
];

const REFLECTION_THEMES = [
  { id: 'leren', icon: '🌱', label: 'Leren', question: 'Wat deed jij vandaag dat helpend was voor dit kind — en wil je vaker inzetten?' },
  { id: 'ontdekken', icon: '🔍', label: 'Ontdekken', question: 'Wat viel je vandaag op aan het kind of de situatie dat je nog niet eerder zo zag?' },
  { id: 'bevestigen', icon: '💚', label: 'Bevestigen', question: 'Wat ging vandaag goed genoeg — zonder dat het beter hoefde?' }
];

const App: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<ReportData>(INITIAL_DATA);
  const [combinedStartValue, setCombinedStartValue] = useState('');
  const [incidentOption, setIncidentOption] = useState<'yes' | 'no' | 'unset'>('unset');
  const [noSpecialties, setNoSpecialties] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [recordingField, setRecordingField] = useState<string | null>(null);

  const [activeSuggestionField, setActiveSuggestionField] = useState<'childName' | null>(null);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [suggestionCursor, setSuggestionCursor] = useState(-1);
  
  const startInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLTextAreaElement>(null);
  const needsWhatRef = useRef<HTMLTextAreaElement>(null);
  const needsActionRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const reflectionRef = useRef<HTMLTextAreaElement>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isUserStoppingRef = useRef<boolean>(false);
  const currentTranscriptionRef = useRef<string>('');

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setActiveSuggestionField(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      stopRecording();
    };
  }, []);
  
  useEffect(() => {
    setShowTooltip(false);
    stopRecording();
  }, [currentStepIndex]);

  const startRecording = (fieldName: string, onUpdate: (value: string) => void, currentValue: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (recognitionRef.current) {
      isUserStoppingRef.current = true;
      recognitionRef.current.stop();
    }
    isUserStoppingRef.current = false;
    currentTranscriptionRef.current = currentValue;
    const recognition = new SpeechRecognition() as SpeechRecognition;
    recognition.lang = 'nl-NL';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; }
      }
      if (finalTranscript) {
        const updated = currentTranscriptionRef.current.trim() ? `${currentTranscriptionRef.current.trim()} ${finalTranscript.trim()}` : finalTranscript.trim();
        currentTranscriptionRef.current = updated;
        onUpdate(updated);
      }
    };
    recognition.onend = () => {
      if (!isUserStoppingRef.current && recordingField === fieldName) {
        try { recognition.start(); } catch (e) {}
      } else { setRecordingField(null); recognitionRef.current = null; }
    };
    recognitionRef.current = recognition;
    setRecordingField(fieldName);
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      isUserStoppingRef.current = true;
      recognitionRef.current.stop();
      setRecordingField(null);
      recognitionRef.current = null;
    }
  };

  const isCurrentStepValid = (() => {
    if (currentStep.key === 'incidents') {
      if (incidentOption === 'no') return true;
      if (incidentOption === 'yes') return formData.incidents.trim().length > 0;
      return false;
    }
    if (currentStep.optional) return true;
    if (currentStep.key === 'childName') {
      const parts = combinedStartValue.trim().split(/\s+/);
      return parts.length >= 2;
    }
    if (currentStep.key === 'activitiesGeneral') {
      return formData.activitiesGeneral.trim().length > 0;
    }
    if (currentStep.key === 'needsSignalsIndruk') {
      if (noSpecialties) return formData.needsAction.trim().length > 0;
      const hasIndruk = formData.needsSignalsIndruk.trim().length > 0;
      const hasCamera = formData.needsSignalsCamera.trim().length > 0;
      if (hasIndruk && !hasCamera) return false;
      return formData.needsWhat.trim().length > 0 && formData.needsAction.trim().length > 0;
    }
    if (currentStep.key === 'goals') {
      return formData.goals[0].title.trim().length > 0 && formData.goals[0].content.trim().length > 0;
    }
    const value = formData[currentStep.key as keyof ReportData];
    return typeof value === 'string' && value.trim().length > 0;
  })();

  const handleNext = async () => {
    if (!isCurrentStepValid || isGenerating) return;
    setActiveSuggestionField(null);
    if (currentStep.key === 'activitiesGeneral') {
      const { start, mid, end } = splitTimeline(formData.activitiesGeneral);
      setFormData(prev => ({ ...prev, activitiesStart: start, activitiesMid: mid, activitiesEnd: end }));
    }
    if (currentStep.key === 'childName') {
      const parts = combinedStartValue.trim().split(/\s+/);
      const initial = parts.pop() || '';
      const name = parts.join(' ');
      setFormData(prev => ({ ...prev, childName: name, begeleiderInitials: initial }));
    }
    if (isLastStep) {
      setIsGenerating(true);
      setError(null);
      try {
        const finalData = { ...formData, incidents: incidentOption === 'yes' ? formData.incidents : '', ...(noSpecialties ? { needsSignalsIndruk: '', needsSignalsCamera: '', needsWhat: '' } : {}) };
        const report = await generateReportSummary(finalData);
        setGeneratedReport(report);
      } catch (err: any) { setError(err.message || "Er is iets misgegaan."); } finally { setIsGenerating(false); }
    } else { setCurrentStepIndex((prev) => prev + 1); }
  };

  const handleBack = () => { if (currentStepIndex > 0) { setCurrentStepIndex((prev) => prev - 1); setActiveSuggestionField(null); } };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'combinedStart') {
      setCombinedStartValue(value);
      const suggestions = CHILD_NAME_SUGGESTIONS;
      const filtered = value.trim() ? suggestions.filter(s => s.toLowerCase().startsWith(value.toLowerCase())).slice(0, 5) : [];
      setFilteredSuggestions(filtered);
      setActiveSuggestionField(filtered.length > 0 ? 'childName' : null);
      setSuggestionCursor(-1);
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    setActiveSuggestionField(null);
  };

  const selectSuggestion = (field: 'childName', value: string) => {
    setCombinedStartValue(value + ' ');
    setActiveSuggestionField(null);
    setTimeout(() => startInputRef.current?.focus(), 10);
  };

  const handleGoalChange = (index: number, field: keyof GoalEntry, value: string) => {
    const newGoals = [...formData.goals];
    newGoals[index] = { ...newGoals[index], [field]: value };
    setFormData((prev) => ({ ...prev, goals: newGoals }));
  };

  const addGoal = () => { if (formData.goals.length < 3) { setFormData((prev) => ({ ...prev, goals: [...prev.goals, { title: '', content: '' }] })); } };
  const removeGoal = (index: number) => { if (formData.goals.length > 1) { const newGoals = formData.goals.filter((_, i) => i !== index); setFormData((prev) => ({ ...prev, goals: newGoals })); } };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isTextArea = (e.target as HTMLElement).tagName === 'TEXTAREA';
    if (activeSuggestionField && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionCursor(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionCursor(prev => (prev > 0 ? prev - 1 : prev)); return; }
      if (e.key === 'Enter' && suggestionCursor >= 0) { e.preventDefault(); selectSuggestion(activeSuggestionField, filteredSuggestions[suggestionCursor]); return; }
      if (e.key === 'Escape') { setActiveSuggestionField(null); return; }
    }
    if (e.key === 'Enter') {
      if (currentStep.key === 'goals') {
         const target = e.target as HTMLTextAreaElement;
         const isLastGoalInput = target.name === `goal-content-${formData.goals.length - 1}`;
         if (isLastGoalInput && !e.shiftKey) { e.preventDefault(); handleNext(); return; }
      }
      if (currentStep.key === 'activitiesGeneral' && !e.shiftKey) { e.preventDefault(); handleNext(); return; }
      if (currentStep.key === 'needsSignalsIndruk') {
        const target = e.target as HTMLTextAreaElement;
        if (target.name === 'needsAction' && !e.shiftKey) { e.preventDefault(); handleNext(); return; }
      }
      if (!isTextArea) { e.preventDefault(); handleNext(); } else if (e.metaKey || e.ctrlKey) { e.preventDefault(); handleNext(); }
    }
  };

  const handleNoSpecialtiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setNoSpecialties(checked);
    if (checked) {
      if (!formData.needsAction.trim()) { setFormData(prev => ({ ...prev, needsAction: "Mijn aanwezigheid en het bieden van structuur was voldoende; K deed mee binnen de afspraken." })); }
      setTimeout(() => needsActionRef.current?.focus(), 10);
    }
  };

  const resetWizard = () => {
    setFormData(INITIAL_DATA);
    setCombinedStartValue('');
    setIncidentOption('unset');
    setNoSpecialties(false);
    setCurrentStepIndex(0);
    setGeneratedReport(null);
    setError(null);
    setCopyFeedback(null);
    setActiveSuggestionField(null);
    stopRecording();
  };

  const handleFinalCopy = async () => {
    if (!generatedReport) return;
    await navigator.clipboard.writeText(generatedReport);
    setCopyFeedback("Verslag gekopieerd! Gegevens worden nu gewist...");
    setTimeout(() => { resetWizard(); }, 2000);
  };

  const renderRecordingButtons = (fieldName: string, onUpdate: (val: string) => void, currentValue: string) => {
    const isRecording = recordingField === fieldName;
    return (
      <div className="absolute right-4 top-4 flex items-center gap-2 z-20 no-print">
        {!isRecording ? (
          <button type="button" onClick={() => startRecording(fieldName, onUpdate, currentValue)} className="group flex items-center gap-2 bg-stone-50 hover:bg-ago-green border border-stone-200 hover:border-ago-green px-3 py-1.5 rounded-full transition-all duration-300 shadow-sm">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse group-hover:bg-white"></div>
            <span className="text-[9px] font-bold text-stone-500 group-hover:text-white uppercase tracking-wider">Start opname</span>
          </button>
        ) : (
          <button type="button" onClick={stopRecording} className="flex items-center gap-2 bg-stone-800 border border-stone-800 px-3 py-1.5 rounded-full transition-all duration-300 shadow-md animate-pulse">
            <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">Stop opname</span>
          </button>
        )}
      </div>
    );
  };

  const renderValidationFlags = (text: string, fieldName: string, isIndrukField: boolean = false) => {
    const results = getValidationResults(text, isIndrukField);
    if (results.length === 0) return null;

    return (
      <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
        {results.map((result, idx) => {
          const config = VALIDATION_CATEGORIES[result.category];
          return (
            <div key={idx} className="p-5 bg-orange-50/50 border border-orange-200/50 rounded-3xl shadow-sm">
              <div className="flex items-start gap-4">
                <div className="text-orange-500 mt-0.5 bg-white p-2 rounded-xl border border-orange-100 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <div className="flex-1 text-[11px] leading-relaxed text-orange-950">
                  <strong className="block mb-1 font-bold uppercase tracking-tight text-orange-600">
                    {config.message} <span className="text-orange-900/40 font-normal lowercase tracking-normal italic ml-1">({result.flaggedWords.join(', ')})</span>
                  </strong>
                  <div className="mt-1 font-medium opacity-90 mb-3">{config.tip}</div>
                  {config.suggestions && (
                    <div className="space-y-2 border-t border-orange-100 pt-3 mt-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400 mb-2">Alternatieve leersuggesties:</p>
                      {config.suggestions.map((suggestion, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => {
                            const currentText = text.trim();
                            const newText = currentText ? `${currentText}\n\n${suggestion}` : suggestion;
                            if (fieldName.includes('goal-content-')) {
                              const goalIndex = parseInt(fieldName.split('-').pop() || '0');
                              handleGoalChange(goalIndex, 'content', newText);
                            } else if (fieldName === 'needsSignalsIndruk') {
                              setFormData(prev => ({ ...prev, [fieldName]: newText }));
                              setTimeout(() => cameraRef.current?.focus(), 10);
                            } else {
                              setFormData(prev => ({ ...prev, [fieldName]: newText }));
                            }
                          }}
                          className="w-full text-left p-3 bg-white hover:bg-orange-100 border border-orange-100 rounded-xl transition-all group relative flex items-center justify-between shadow-sm"
                        >
                          <span className="opacity-80 group-hover:opacity-100 pr-8">{suggestion}</span>
                          <span className="text-[8px] font-bold uppercase text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3">+ Toevoegen</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFormattedReport = (text: string) => {
    const sections = text.split('\n\n');
    return sections.map((section, idx) => {
      const lines = section.split('\n');
      const firstLine = lines[0];
      const isIncident = firstLine.includes('**INCIDENT**');
      return (
        <div key={idx} className={`relative mb-6 ${isIncident ? 'p-6 bg-red-50/30 rounded-3xl border border-red-100 border-dashed' : ''}`}>
          {lines.map((line, i) => {
            const isBold = line.startsWith('**') && line.endsWith('**');
            if (isBold) { return <p key={i} className={`font-bold mt-2 mb-3 uppercase tracking-widest text-sm border-b pb-1 ${line.includes('INCIDENT') ? 'text-red-600 border-red-100' : 'text-ago-green border-ago-green/10'}`}>{line.replace(/\*\*/g, '')}</p>; }
            return line.trim() === '' ? null : <p key={i} className="mb-2 leading-relaxed text-stone-600">{line}</p>;
          })}
        </div>
      );
    });
  };

  return (
    <Layout>
      {generatedReport ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-light text-stone-800">Concept Verslag</h2>
            <button onClick={resetWizard} className="text-stone-400 hover:text-red-400 transition-colors text-xs uppercase tracking-widest font-medium">Annuleren & Wissen</button>
          </div>
          <div className="bg-[#fcfcfc] p-8 sm:p-10 rounded-[32px] border border-stone-100 font-sans shadow-inner overflow-hidden relative min-h-[400px]">
            <div className="absolute top-0 left-0 w-1 h-full bg-ago-green/20"></div>
            {renderFormattedReport(generatedReport)}
          </div>
          <div className="mt-10">
             <button onClick={handleFinalCopy} disabled={!!copyFeedback} className={`w-full py-5 px-6 rounded-2xl font-bold uppercase text-[12px] tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${copyFeedback ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-ago-green text-white hover:bg-ago-green-dark shadow-ago-green/20'}`}>
                {copyFeedback || "Kopieer naar klembord & sluit"}
             </button>
          </div>
        </div>
      ) : (
        <>
          <StepIndicator currentStep={currentStepIndex + 1} totalSteps={WIZARD_STEPS.length} />
          <div className="space-y-8">
            <header>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-ago-green uppercase tracking-[0.2em] block mb-2">Stap {currentStep.id} / {WIZARD_STEPS.length}</span>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-light text-stone-800">{currentStep.label}</h2>
                    {currentStep.tooltip && (
                      <div className="relative">
                        <button onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} onClick={() => setShowTooltip(!showTooltip)} className="w-5 h-5 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:border-ago-green hover:text-ago-green transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></button>
                        {showTooltip && (
                          <div className="absolute z-[100] left-0 top-full mt-2 w-64 p-4 bg-stone-800 text-white text-[11px] leading-relaxed rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-200">
                            <div className="absolute -top-1 left-4 w-2 h-2 bg-stone-800 rotate-45"></div>
                            {currentStep.tooltip}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-stone-400 font-light text-sm mt-3 leading-relaxed">{currentStep.description}</p>
            </header>

            <div className="min-h-[220px] relative">
              {currentStep.key === 'incidents' ? (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <button onClick={() => setIncidentOption('yes')} className={`flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all border ${incidentOption === 'yes' ? 'bg-ago-green text-white border-ago-green shadow-lg' : 'bg-white text-stone-400 border-stone-100 hover:border-ago-green/30'}`}>Ja, incident</button>
                    <button onClick={() => { setIncidentOption('no'); setFormData(prev => ({ ...prev, incidents: '' })); }} className={`flex-1 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all border ${incidentOption === 'no' ? 'bg-ago-green text-white border-ago-green shadow-lg' : 'bg-white text-stone-400 border-stone-100 hover:border-ago-green/30'}`}>Nee, geen incident</button>
                  </div>
                  {incidentOption === 'yes' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                      <div className="relative">
                        {renderRecordingButtons('incidents', (v) => setFormData(p => ({ ...p, incidents: v })), formData.incidents)}
                        <textarea name="incidents" value={formData.incidents} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Beschrijf feitelijk what er voorafging..." autoFocus rows={6} className="w-full bg-stone-50/50 border border-stone-100 rounded-[32px] p-6 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-ago-green/10 focus:border-ago-green/30 transition-all text-xl font-light resize-none" />
                      </div>
                      {renderValidationFlags(formData.incidents, 'incidents')}
                    </div>
                  )}
                </div>
              ) : currentStep.key === 'childName' ? (
                <div className="space-y-6" ref={suggestionRef}>
                  <div className="space-y-2 relative">
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1">Initiaal kind + jouw initiaal</label>
                    <div className="relative">
                      {renderRecordingButtons('combinedStart', (v) => setCombinedStartValue(v), combinedStartValue)}
                      <input ref={startInputRef} type="text" name="combinedStart" value={combinedStartValue} onChange={handleInputChange} onKeyDown={handleKeyDown} autoComplete="off" placeholder={currentStep.placeholder} autoFocus className="w-full bg-stone-50/50 border border-stone-100 rounded-[24px] p-5 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-ago-green/10 focus:border-ago-green/30 transition-all text-xl font-light pr-16" />
                    </div>
                    {activeSuggestionField === 'childName' && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-stone-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {filteredSuggestions.map((s, i) => (
                          <button key={s} onClick={() => selectSuggestion('childName', s)} className={`w-full text-left px-5 py-3 text-stone-600 hover:bg-ago-green-light hover:text-ago-green transition-colors text-lg font-light ${suggestionCursor === i ? 'bg-ago-green-light text-ago-green' : ''}`}>{s}</button>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-stone-400 italic px-2">Eerst de initiaal van het kind, daarna een spatie en jouw initiaal.</p>
                  </div>
                </div>
              ) : currentStep.key === 'activitiesGeneral' ? (
                <div className="space-y-6">
                  <div className="space-y-1 relative">
                    {renderRecordingButtons('activitiesGeneral', (v) => setFormData(p => ({ ...p, activitiesGeneral: v })), formData.activitiesGeneral)}
                    <textarea name="activitiesGeneral" value={formData.activitiesGeneral} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={currentStep.placeholder} autoFocus rows={10} className="w-full bg-stone-50/50 border border-stone-100 rounded-[32px] p-6 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-xl font-light resize-none" />
                    {renderValidationFlags(formData.activitiesGeneral, 'activitiesGeneral')}
                  </div>
                  <p className="text-[11px] text-stone-400 italic px-2">Gebruik woorden als "daarna", "vervolgens" en "aan het einde" voor een optimale verwerking.</p>
                </div>
              ) : currentStep.key === 'needsSignalsIndruk' ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-stone-50/80 rounded-2xl border border-stone-100 mb-2">
                    <input type="checkbox" id="no-specialties" checked={noSpecialties} onChange={handleNoSpecialtiesChange} className="mt-1 w-4 h-4 rounded bg-white border-stone-300 text-ago-green focus:ring-ago-green" />
                    <label htmlFor="no-specialties" className="cursor-pointer">
                      <span className="block text-sm font-semibold text-stone-700">Geen bijzonderheden (het liep passend / regulier)</span>
                      <span className="block text-[11px] text-stone-500 mt-1">Er waren geen opvallende signalen of extra ondersteuning nodig; basis-aanwezigheid was voldoende.</span>
                    </label>
                  </div>

                  {!noSpecialties && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className={`space-y-1 relative p-4 rounded-[24px] border transition-all ${formData.needsSignalsIndruk.trim() ? 'bg-ago-green-light/30 border-ago-green/20' : 'bg-stone-50/50 border-stone-100'}`}>
                        {formData.needsSignalsIndruk.trim() && (
                          <div className="absolute -top-3 left-4 px-2 bg-white rounded-full border border-ago-green/10 flex items-center gap-1.5 shadow-sm">
                            <svg className="text-ago-green" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <span className="text-[8px] font-bold uppercase text-ago-green tracking-widest">Guided Input</span>
                          </div>
                        )}
                        {renderRecordingButtons('needsSignalsIndruk', (v) => setFormData(p => ({ ...p, needsSignalsIndruk: v })), formData.needsSignalsIndruk)}
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1">SIGNALEN – indruk (optioneel)</label>
                        <textarea name="needsSignalsIndruk" value={formData.needsSignalsIndruk} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Bijv: K leek gefrustreerd / boos / gespannen…" rows={2} className="w-full bg-transparent border-none p-2 text-stone-800 placeholder:text-stone-500 focus:outline-none transition-all text-base font-light resize-none" />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {SIGNAL_SUGGESTIONS.map((suggestion, idx) => (
                            <button key={idx} onClick={() => {
                              const current = formData.needsSignalsIndruk.trim();
                              const newValue = current ? `${current}, ${suggestion}` : suggestion;
                              setFormData(p => ({ ...p, needsSignalsIndruk: newValue }));
                              setTimeout(() => cameraRef.current?.focus(), 10);
                            }} className="text-[9px] px-2.5 py-1.5 bg-stone-100 text-stone-500 rounded-full hover:bg-ago-green hover:text-white transition-all font-bold uppercase tracking-wider">{suggestion}</button>
                          ))}
                        </div>
                        {formData.needsSignalsIndruk.trim().length > 0 && (
                          <div className="mt-3 p-3 bg-ago-green/5 border border-ago-green/10 rounded-xl">
                            <p className="text-[11px] text-ago-green-dark font-medium italic">Je koos een indruk. Beschrijf hieronder waaraan je dit zag of hoorde (de camera).</p>
                          </div>
                        )}
                        {renderValidationFlags(formData.needsSignalsIndruk, 'needsSignalsIndruk', true)}
                      </div>
                      <div className="space-y-1 relative border-t border-stone-50 pt-6">
                        {renderRecordingButtons('needsSignalsCamera', (v) => setFormData(p => ({ ...p, needsSignalsCamera: v })), formData.needsSignalsCamera)}
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1 flex items-center gap-2">
                          Waaraan zag of hoorde je dit? <span className="cursor-help text-xs opacity-50" title="🎥 Alsof een camera het zou registreren: wat ziet, en what hoort deze letterlijk?">🎥</span>
                        </label>
                        <textarea ref={cameraRef} name="needsSignalsCamera" value={formData.needsSignalsCamera} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Bijv. liep weg, keek weg, ademde snel en reageerde niet op aanspreken." rows={3} className={`w-full bg-stone-50/50 border rounded-2xl p-4 text-stone-800 placeholder:text-stone-500 focus:outline-none transition-all text-base font-light resize-none ${formData.needsSignalsIndruk.trim().length > 0 && formData.needsSignalsCamera.trim().length === 0 ? 'border-ago-green/30 ring-2 ring-ago-green/5' : 'border-stone-100 focus:border-ago-green/30'}`} />
                        {formData.needsSignalsIndruk.trim().length > 0 && formData.needsSignalsCamera.trim().length === 0 && (
                          <p className="text-[10px] text-ago-green-dark font-bold uppercase tracking-tight mt-1 ml-1 animate-in slide-in-from-left-2 duration-300 italic">Beleef het moment opnieuw: wat zou een camera letterlijk hebben gezien en gehoord?</p>
                        )}
                        {renderValidationFlags(formData.needsSignalsCamera, 'needsSignalsCamera')}
                      </div>
                      <div className="space-y-1 relative border-t border-stone-50 pt-6">
                        {renderRecordingButtons('needsWhat', (v) => setFormData(p => ({ ...p, needsWhat: v })), formData.needsWhat)}
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1">NODIG</label>
                        <textarea ref={needsWhatRef} name="needsWhat" value={formData.needsWhat} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Wat had het kind op dat moment van jou nodig?" rows={2} className="w-full bg-stone-50/50 border border-stone-100 rounded-2xl p-4 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-base font-light resize-none" />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {NEEDS_SUGGESTIONS.map((suggestion, idx) => (
                            <button key={idx} onClick={() => {
                              const current = formData.needsWhat.trim();
                              const newValue = current ? `${current}, ${suggestion.toLowerCase()}` : suggestion;
                              setFormData(p => ({ ...p, needsWhat: newValue }));
                              setTimeout(() => needsActionRef.current?.focus(), 10);
                            }} className="text-[9px] px-2.5 py-1.5 bg-stone-100 text-stone-500 rounded-full hover:bg-ago-green hover:text-white transition-all font-bold uppercase tracking-wider">{suggestion}</button>
                          ))}
                        </div>
                        {renderValidationFlags(formData.needsWhat, 'needsWhat')}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 relative border-t border-stone-100 pt-6">
                    {renderRecordingButtons('needsAction', (v) => setFormData(p => ({ ...p, needsAction: v })), formData.needsAction)}
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1">Wat deed jij concreet als begeleider?</label>
                    <p className="text-[11px] text-stone-400 leading-relaxed mb-2 px-1">Beschrijf feitelijk what je deed of zei. Als er geen bijzonderheden waren: beschrijf kort wat voldoende was (bijv. aanwezigheid/structuur).</p>
                    <textarea ref={needsActionRef} name="needsAction" value={formData.needsAction} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Bijv: Ik ging naast K zitten, sprak rustig, benoemde wat er ging gebeuren en gaf twee keuzes." rows={3} className="w-full bg-stone-50/50 border border-stone-100 rounded-2xl p-4 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-base font-light resize-none" />
                    {renderValidationFlags(formData.needsAction, 'needsAction')}
                  </div>
                </div>
              ) : currentStep.key === 'goals' ? (
                <div className="space-y-10">
                  {formData.goals.map((goal, index) => (
                    <div key={index} className="relative p-6 rounded-[32px] bg-stone-50/50 border border-stone-100 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="bg-ago-green text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Doel {index + 1}</span>
                        {formData.goals.length > 1 && <button onClick={() => removeGoal(index)} className="text-[10px] text-stone-300 hover:text-red-400 transition-colors uppercase font-bold tracking-tighter">Verwijder</button>}
                      </div>
                      <div className="space-y-2 relative">
                        {renderRecordingButtons(`goal-title-${index}`, (v) => handleGoalChange(index, 'title', v), goal.title)}
                        <label className="text-sm font-semibold text-stone-700 ml-1">Welk behandeldoel?</label>
                        <input type="text" name={`goal-title-${index}`} value={goal.title} onChange={(e) => handleGoalChange(index, 'title', e.target.value)} onKeyDown={handleKeyDown} placeholder="Bijv: Emotieregulatie" className="w-full bg-white border border-stone-100 rounded-2xl p-4 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-base font-medium pr-16" />
                      </div>
                      <div className="space-y-1 relative border-t border-stone-50 pt-4">
                        {renderRecordingButtons(`goal-content-${index}`, (v) => handleGoalChange(index, 'content', v), goal.content)}
                        <h4 className="text-xs font-bold text-stone-700 mt-2 mb-1 px-1 uppercase tracking-tight">Wat gebeurde er bij dit doel?</h4>
                        <p className="text-[11px] text-stone-400 leading-relaxed mb-2 px-1">Schrijf kort en concreet wat je vandaag rondom dit doel zag gebeuren bij het kind en wat jouw rol daarin was.</p>
                        <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1">Toelichting bij dit doel</label>
                        <textarea name={`goal-content-${index}`} value={goal.content} onChange={(e) => handleGoalChange(index, 'content', e.target.value)} onKeyDown={handleKeyDown} rows={6} placeholder={"Bijv.\nHet kind: gaf aan wanneer iets te spannend werd en bleef in mijn buurt.\nIk: bleef nabij, benoemde wat er gebeurde en deed samen voor.\nWat lukte / wat nog lastig is: aangeven lukt, zelf reguleren vraagt nog begeleiding."} className="w-full bg-white border border-stone-100 rounded-2xl p-4 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-base font-light resize-none" />
                        {renderValidationFlags(goal.content, `goal-content-${index}`)}
                      </div>
                    </div>
                  ))}
                  {formData.goals.length < 3 && <button onClick={addGoal} className="w-full py-4 border-2 border-dashed border-stone-100 rounded-[24px] text-stone-400 hover:text-ago-green hover:border-ago-green/20 transition-all text-xs font-bold uppercase tracking-widest bg-stone-50/20">+ Extra Doel ({formData.goals.length}/3)</button>}
                </div>
              ) : currentStep.key === 'extraContext' ? (
                <div className="space-y-10">
                  <div className="relative">
                    {renderRecordingButtons('extraContext', (v) => setFormData(p => ({ ...p, extraContext: v })), formData.extraContext)}
                    <label className="text-[10px] uppercase tracking-widest text-stone-400 font-bold ml-1 mb-2 block">Extra Context (voor in het verslag)</label>
                    <textarea name="extraContext" value={formData.extraContext} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={currentStep.placeholder} autoFocus rows={4} className="w-full bg-stone-50/50 border border-stone-100 rounded-[32px] p-6 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-ago-green/10 focus:border-ago-green/30 transition-all text-xl font-light resize-none" />
                    {renderValidationFlags(formData.extraContext, 'extraContext')}
                  </div>
                  <div className="mt-8 pt-8 border-t border-stone-100 space-y-6">
                    <div>
                      <label className="text-sm font-semibold text-stone-700 block mb-1">Wat neem jij mee van vandaag? (optioneel)</label>
                      <p className="text-[11px] text-stone-400 font-light mb-4 italic">Korte reflectie voor jezelf. Wordt niet opgenomen in de rapportage.</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {REFLECTION_THEMES.map((theme) => (
                          <button key={theme.id} type="button" onClick={() => { setFormData(prev => ({ ...prev, reflectionQuestion: theme.question })); setTimeout(() => reflectionRef.current?.focus(), 10); }} className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border ${formData.reflectionQuestion === theme.question ? 'bg-ago-green text-white border-ago-green' : 'bg-white text-stone-400 border-stone-100 hover:border-stone-200'}`}>{theme.icon} {theme.label}</button>
                        ))}
                      </div>
                      {formData.reflectionQuestion && (
                        <div className="mb-4 p-4 bg-ago-green-light/50 border border-ago-green/10 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-300"><p className="text-[11px] text-ago-green-dark font-medium italic">{formData.reflectionQuestion}</p></div>
                      )}
                      <div className="relative">
                        {renderRecordingButtons('reflection', (v) => setFormData(p => ({ ...p, reflection: v })), formData.reflection)}
                        <textarea ref={reflectionRef} name="reflection" value={formData.reflection} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={4} placeholder="Bijv: Ik merkte dat mijn rustige aanwezigheid voldoende was." className="w-full bg-stone-50/50 border border-stone-100 rounded-[24px] p-5 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:border-ago-green/30 transition-all text-base font-light resize-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {renderRecordingButtons(currentStep.key, (v) => setFormData(p => ({ ...p, [currentStep.key]: v })), formData[currentStep.key as keyof ReportData] as string)}
                  <textarea name={currentStep.key} value={formData[currentStep.key as keyof ReportData] as string} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={currentStep.placeholder} autoFocus rows={7} className="w-full bg-stone-50/50 border border-stone-100 rounded-[32px] p-6 text-stone-800 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-ago-green/10 focus:border-ago-green/30 transition-all text-xl font-light resize-none" />
                  {renderValidationFlags(formData[currentStep.key as keyof ReportData] as string, currentStep.key)}
                </div>
              )}
            </div>

            {error && <div className="p-4 bg-red-50 text-red-500 text-xs rounded-2xl border border-red-100 animate-shake">{error}</div>}

            <div className="flex items-center justify-between pt-8 border-t border-stone-50">
              <button onClick={handleBack} disabled={currentStepIndex === 0 || isGenerating} className={`px-6 py-3 text-stone-400 hover:text-stone-600 transition-colors uppercase text-[10px] font-bold tracking-widest ${currentStepIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}>Vorige</button>
              <button ref={nextBtnRef} onClick={handleNext} disabled={isGenerating || !isCurrentStepValid} className={`py-4 px-10 rounded-2xl font-bold uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center min-w-[200px] ${isGenerating || !isCurrentStepValid ? 'bg-stone-100 text-stone-300 cursor-not-allowed shadow-none' : 'bg-ago-green text-white hover:bg-ago-green-dark active:scale-95 shadow-xl shadow-ago-green/20'}`}>
                {isGenerating ? <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Analyseren...</span> : (isLastStep ? 'Genereer' : 'Volgende')}
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
};

export default App;

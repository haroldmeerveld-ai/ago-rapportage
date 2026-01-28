
import { StepConfig, ReportData } from './types';

export const WIZARD_STEPS: StepConfig[] = [
  {
    id: 1,
    key: 'childName',
    label: 'Start rapportage',
    description: 'Wie ben jij en voor wie schrijf je? Voer de initiaal van het kind en jouw initiaal in.',
    placeholder: 'Bijv: B J'
  },
  {
    id: 2,
    key: 'activitiesGeneral',
    label: 'Verloop van de activiteit (start – verloop – afronding)',
    description: 'Spreek of schrijf in één keer. Begin bij de start, beschrijf daarna het verloop en sluit af met de afronding.',
    placeholder: 'Bijv: We begonnen met vuur maken in het kader van het vuurdiploma. Het kind deed alle stappen zelf en dit verliep volgens plan. Daarna hebben we samen opgeruimd. In het tweede deel van de ochtend maakten we een boswandeling en telden we samen hoeveel verschillende vogelgeluiden we hoorden. We kwamen uit op vier.'
  },
  {
    id: 3,
    key: 'needsSignalsIndruk',
    label: 'Algemeen: Behoeften',
    description: 'Beschrijf feitelijk waar het kind tegenaan liep en hoe jij hier als begeleider op hebt aangesloten.',
    placeholder: ''
  },
  {
    id: 4,
    key: 'goals',
    label: 'Doelen & Voortgang',
    description: 'Beschrijf per doel specifiek wat er is gedaan, wat zelf lukte and wat jouw rol was.',
    placeholder: '',
    tooltip: 'Wees specifiek en feitelijk. Beschrijf bij elk doel wat de focus van de dag was, wat het kind zelfstandig heeft bereikt en op welke momenten jouw ondersteuning of sturing nodig was om het doel te behalen.'
  },
  {
    id: 5,
    key: 'incidents',
    label: 'Incidenten',
    description: 'Was er vandaag een specifieke, onverwachte situatie die niet wekelijks voorkomt?',
    placeholder: 'Beschrijf feitelijk wat er voorafging, het handelen en de afronding...',
    optional: true
  },
  {
    id: 6,
    key: 'extraContext',
    label: 'Extra Context',
    description: 'Zijn er nog andere zaken die belangrijk zijn voor dit verslag?',
    placeholder: 'Bijv: Er was een fijne sfeer in de groep vandaag.',
    optional: true
  }
];

export const INITIAL_DATA: ReportData = {
  childName: '',
  begeleiderInitials: '',
  activitiesGeneral: '',
  activitiesStart: '',
  activitiesMid: '',
  activitiesEnd: '',
  needsSignalsIndruk: '',
  needsSignalsCamera: '',
  needsWhat: '',
  needsAction: '',
  goals: [{ title: '', content: '' }],
  incidents: '',
  extraContext: '',
  reflection: '',
  reflectionQuestion: ''
};

export const CHILD_NAME_SUGGESTIONS = [
  'Bram', 'Daan', 'Emma', 'Finn', 'Julia', 'Levi', 'Lars', 'Mila', 'Noah', 'Saar', 'Sem', 'Tess', 'Zoë',
  'Kevin', 'Lisa', 'Milan', 'Sophie', 'Thijs', 'Lieke', 'Luuk', 'Fleur', 'Stijn', 'Eva'
];

export const INITIALS_SUGGESTIONS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'W'
];

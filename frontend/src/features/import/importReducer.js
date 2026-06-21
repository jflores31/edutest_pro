import { validateDraftRow } from './validateDraftRow';

function genId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function rowFromServer(raw) {
  const row = {
    _id: raw._id || genId(),
    _isDirty: false,
    _isNew: false,
    _errors: [],
    text: raw.text || '',
    question_type: raw.question_type || 'MULTIPLE_CHOICE',
    option_a: raw.option_a || '',
    option_b: raw.option_b || '',
    option_c: raw.option_c || '',
    option_d: raw.option_d || '',
    correct_answer: raw.correct_answer || '',
    category: raw.category || '',
    explanation: raw.explanation || '',
  };
  row._errors = validateDraftRow(row);
  return row;
}

function emptyRow() {
  const row = {
    _id: genId(),
    _isDirty: false,
    _isNew: true,
    _errors: [],
    text: '',
    question_type: 'MULTIPLE_CHOICE',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: '',
    category: '',
    explanation: '',
  };
  row._errors = validateDraftRow(row);
  return row;
}

export const initialState = {
  phase: 'idle',
  draftToken: null,
  draftRows: [],
  globalErrors: [],
  validationErrors: [],
  search: '',
  filterType: 'all',
  currentPage: 0,
  pageSize: 25,
  questionsCreated: 0,
  questionIds: [],
};

export function importReducer(state, action) {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.payload };

    case 'SET_PREVIEW': {
      const { draftToken, rows, globalErrors } = action.payload;
      const draftRows = (rows || []).map(rowFromServer);
      return {
        ...state,
        phase: 'preview_ready',
        draftToken,
        draftRows,
        globalErrors: globalErrors || [],
        validationErrors: [],
        search: '',
        filterType: 'all',
        currentPage: 0,
      };
    }

    case 'SET_GLOBAL_ERRORS':
      return { ...state, globalErrors: action.payload || [] };

    case 'UPDATE_ROW': {
      const { id, patch } = action.payload;
      const draftRows = state.draftRows.map(row => {
        if (row._id !== id) return row;
        const updated = { ...row, ...patch, _isDirty: true };
        updated._errors = validateDraftRow(updated);
        return updated;
      });
      return {
        ...state,
        draftRows,
        phase: state.phase === 'preview_ready' ? 'editing' : state.phase,
      };
    }

    case 'DELETE_ROW':
      return {
        ...state,
        draftRows: state.draftRows.filter(r => r._id !== action.payload.id),
        phase: state.phase === 'preview_ready' ? 'editing' : state.phase,
      };

    case 'DUPLICATE_ROW': {
      const idx = state.draftRows.findIndex(r => r._id === action.payload.id);
      if (idx === -1) return state;
      const src = state.draftRows[idx];
      const copy = { ...src, _id: genId(), _isDirty: false, _isNew: true };
      copy._errors = validateDraftRow(copy);
      const draftRows = [
        ...state.draftRows.slice(0, idx + 1),
        copy,
        ...state.draftRows.slice(idx + 1),
      ];
      return { ...state, draftRows, phase: state.phase === 'preview_ready' ? 'editing' : state.phase };
    }

    case 'ADD_EMPTY_ROW':
      return {
        ...state,
        draftRows: [...state.draftRows, emptyRow()],
        phase: state.phase === 'preview_ready' ? 'editing' : state.phase,
      };

    case 'SET_SEARCH':
      return { ...state, search: action.payload, currentPage: 0 };

    case 'SET_FILTER_TYPE':
      return { ...state, filterType: action.payload, currentPage: 0 };

    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'SET_CONFIRMING':
      return { ...state, phase: 'confirming', validationErrors: [] };

    case 'SET_DONE':
      return { ...state, phase: 'done', questionsCreated: action.payload.questionsCreated, questionIds: action.payload.questionIds || [] };

    case 'SET_ERROR':
      return { ...state, phase: 'error', globalErrors: [{ message: action.payload.message }] };

    case 'SET_VALIDATION_ERRORS':
      return { ...state, phase: 'editing', validationErrors: action.payload };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

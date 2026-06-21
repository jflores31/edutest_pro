const BOOLEAN_VALUES = new Set(['true', 'false', 'verdadero', 'falso', '1', '0']);

export function validateDraftRow(row) {
  const errors = [];
  const text = (row.text || '').trim();

  if (!text) {
    errors.push({ field: 'text', message: 'El enunciado es requerido' });
  } else if (text.length > 1000) {
    errors.push({ field: 'text', message: `Máximo 1,000 caracteres (${text.length} actuales)` });
  }

  const qtype = row.question_type || 'MULTIPLE_CHOICE';

  if (qtype === 'MULTIPLE_CHOICE') {
    const definedOptions = ['option_a', 'option_b', 'option_c', 'option_d'].filter(
      k => (row[k] || '').trim()
    );
    if (definedOptions.length < 2) {
      errors.push({ field: 'options', message: 'Se necesitan al menos 2 opciones' });
    }

    const correct = (row.correct_answer || '').trim();
    if (!correct) {
      errors.push({ field: 'correct_answer', message: 'Selecciona la respuesta correcta' });
    } else {
      const definedKeys = new Set(
        ['A', 'B', 'C', 'D'].filter(k => (row[`option_${k.toLowerCase()}`] || '').trim())
      );
      const correctKeys = correct.toUpperCase().split(/[^A-D]+/).filter(k => /^[A-D]$/.test(k));
      for (const k of correctKeys) {
        if (!definedKeys.has(k)) {
          errors.push({ field: 'correct_answer', message: `La respuesta '${k}' no tiene opción definida` });
          break;
        }
      }
    }
  } else if (qtype === 'BOOLEAN') {
    const correct = (row.correct_answer || '').trim().toLowerCase();
    if (!BOOLEAN_VALUES.has(correct)) {
      errors.push({ field: 'correct_answer', message: "Debe ser 'true' o 'false'" });
    }
  } else if (qtype === 'SHORT_ANSWER') {
    if (!(row.correct_answer || '').trim()) {
      errors.push({ field: 'correct_answer', message: 'La respuesta correcta es requerida' });
    }
  }

  return errors;
}

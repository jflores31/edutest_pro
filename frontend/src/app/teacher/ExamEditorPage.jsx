/**
 * ExamEditorPage.jsx — Crear/Editar examen
 * Permite configurar preguntas, duración, opciones de visualización
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Card, Input, Toggle, Tabs } from '../../design-system';
import { useToast } from '../../features/toast/ToastProvider';
import { exams as examsApi, questions as questionsApi } from '../../services/api';
import { ConfirmModal } from '../../features/shared/ConfirmModal';

// Module-level counter for unique element ids. Avoids Date.now() collisions
// when several ids are generated within the same millisecond (e.g. two options).
let _uidCounter = 0;
const uid = (prefix) => `${prefix}-${++_uidCounter}`;

const QUESTION_TYPES = [
  { key: 'single_choice', label: 'Opción única', icon: 'check' },
  { key: 'multiple_choice', label: 'Opción múltiple', icon: 'check' },
  { key: 'boolean', label: 'Verdadero/Falso', icon: 'check' },
  { key: 'short_answer', label: 'Respuesta corta', icon: 'edit' },
];

// Frontend type → backend enum
const BACKEND_TYPE = {
  single_choice: 'MULTIPLE_CHOICE',
  multiple_choice: 'MULTIPLE_CHOICE',
  boolean: 'BOOLEAN',
  short_answer: 'SHORT_ANSWER',
};

function mapQuestionToApi(q) {
  const options = (q.options || []).map((o, i) => ({
    key: String.fromCharCode(65 + i),
    text: o.text,
  }));

  const metadata = { options };

  if (q.type === 'boolean') {
    metadata.correct_answer = q.correct ?? false;
  } else if (q.type === 'short_answer') {
    metadata.correct_answer = q.correctAnswer ?? '';
  } else if (q.type === 'multiple_choice') {
    // varias respuestas correctas → correct_keys (array)
    const keys = (q.correctKeys && q.correctKeys.length)
      ? q.correctKeys
      : (q.correctKey ? [q.correctKey] : [options[0]?.key || 'A']);
    metadata.correct_keys = keys;
    metadata.correct_key = keys.join(',');
  } else {
    // single_choice — una sola respuesta correcta
    const key = q.correctKey ?? (options[0]?.key || 'A');
    metadata.correct_key = key;
    metadata.correct_keys = [key];
  }

  if (q.explanation) metadata.explanation = q.explanation;
  if (q.topic || q.difficulty) {
    metadata.topic = q.topic || '';
    metadata.difficulty = q.difficulty || 'medium';
  }

  return {
    question_type: BACKEND_TYPE[q.type] || 'MULTIPLE_CHOICE',
    question_text: q.text || '',
    metadata,
  };
}

function normalizeLoadedQuestion(q, eq) {
  const meta = q.question?.metadata || {};
  const qType = q.question?.question_type || 'MULTIPLE_CHOICE';
  // Respuestas correctas: correct_keys (array) o correct_key ("A" o "A,C").
  const correctKeys = (Array.isArray(meta.correct_keys) && meta.correct_keys.length)
    ? meta.correct_keys.map(k => String(k).toUpperCase())
    : (meta.correct_key
        ? String(meta.correct_key).split(/[^A-Ea-e]+/).filter(Boolean).map(k => k.toUpperCase())
        : []);
  // Única vs múltiple = nº de respuestas correctas (el backend usa MULTIPLE_CHOICE para ambas).
  const frontendType = qType === 'BOOLEAN' ? 'boolean'
    : qType === 'SHORT_ANSWER' ? 'short_answer'
    : (correctKeys.length > 1 ? 'multiple_choice' : 'single_choice');
  const opts = (meta.options || []).map((o, i) => ({ id: `opt-${q.id}-${i}`, text: o.text || '' }));
  return {
    id: q.id,
    _questionId: q.question?.id,
    type: frontendType,
    text: q.question?.question_text || '',
    options: opts.length ? opts : undefined,
    correct: meta.correct_answer ?? null,
    correctKey: correctKeys[0] ?? null,
    correctKeys,
    explanation: meta.explanation ?? '',
    topic: meta.topic ?? '',
    points: eq?.points ?? q.points ?? 1,
    difficulty: meta.difficulty ?? 'medium',
    order: q.order ?? 1,
  };
}

function QuestionEditor({ question, index, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(true);

  const updateField = (field, value) => {
    onUpdate({ ...question, [field]: value });
  };

  const addOption = () => {
    const options = question.options || [];
    onUpdate({ ...question, options: [...options, { id: uid('opt'), text: '' }] });
  };

  const updateOption = (optId, text) => {
    const options = (question.options || []).map(o =>
      o.id === optId ? { ...o, text } : o
    );
    onUpdate({ ...question, options });
  };

  const removeOption = (optId) => {
    const options = (question.options || []).filter(o => o.id !== optId);
    onUpdate({ ...question, options });
  };

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent text-sm font-bold">
            {index + 1}
          </span>
          <select
            value={question.type}
            onChange={e => updateField('type', e.target.value)}
            className="bg-transparent border-2 border-line rounded-xl px-3 py-1.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
          >
            {QUESTION_TYPES.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            <Icon name="chevron-down" size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Icon name="trash" size={14} className="text-danger" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4">
          <Input
            label="Pregunta"
            value={question.text || ''}
            onChange={e => updateField('text', e.target.value)}
            placeholder="Escribe la pregunta aquí..."
          />

          {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
            <div>
              <label className="block text-xs text-fg-1 font-medium mb-2">Opciones</label>
              <div className="space-y-2">
                {(question.options || []).map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isMulti = question.type === 'multiple_choice';
                  const checked = isMulti
                    ? (question.correctKeys || []).includes(letter)
                    : question.correctKey === letter;
                  const toggleCorrect = () => {
                    if (isMulti) {
                      const cur = question.correctKeys || [];
                      const next = cur.includes(letter) ? cur.filter(k => k !== letter) : [...cur, letter].sort();
                      onUpdate({ ...question, correctKeys: next, correctKey: next[0] || null });
                    } else {
                      onUpdate({ ...question, correctKey: letter, correctKeys: [letter] });
                    }
                  };
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type={isMulti ? 'checkbox' : 'radio'}
                        name={`correct-${question.id}`}
                        checked={checked}
                        onChange={toggleCorrect}
                        title="Marcar como correcta"
                      />
                      <span className="text-xs text-fg-3 w-6">{letter}.</span>
                      <Input
                        value={opt.text}
                        onChange={e => updateOption(opt.id, e.target.value)}
                        placeholder={`Opción ${letter}`}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeOption(opt.id)}>
                        <Icon name="x" size={14} className="text-fg-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="mt-2" onClick={addOption} icon={<Icon name="plus" size={12} />}>
                Agregar opción
              </Button>
            </div>
          )}

          {question.type === 'boolean' && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" name={`correct-${question.id}`} checked={question.correct === true} onChange={() => updateField('correct', true)} />
                <span className="text-sm text-fg-1">Verdadero es correcta</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name={`correct-${question.id}`} checked={question.correct === false} onChange={() => updateField('correct', false)} />
                <span className="text-sm text-fg-1">Falso es correcta</span>
              </label>
            </div>
          )}

          {question.type === 'short_answer' && (
            <Input
              label="Respuesta esperada"
              value={question.correctAnswer || ''}
              onChange={e => updateField('correctAnswer', e.target.value)}
              placeholder="Escribe la respuesta correcta..."
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Puntos"
              type="number"
              value={question.points || 1}
              onChange={e => updateField('points', parseInt(e.target.value) || 1)}
              min="1"
            />
            <div>
              <label className="block text-xs text-fg-1 font-medium mb-1">Dificultad</label>
              <select
                value={question.difficulty || 'medium'}
                onChange={e => updateField('difficulty', e.target.value)}
                className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Media</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
          </div>

          <Input
            label="Explicación (opcional)"
            value={question.explanation || ''}
            onChange={e => updateField('explanation', e.target.value)}
            placeholder="Explicación de la respuesta correcta..."
          />
        </div>
      )}
    </Card>
  );
}

export default function ExamEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [exam, setExam] = useState({
    title: '',
    description: '',
    duration_minutes: null,
    maxAttempts: null,
    questions: [],
    showNota: true,
    showResp: false,
    showExpl: false,
  });

  const [saving, setSaving] = useState(false);
  const [loadingExam, setLoadingExam] = useState(isEditing);
  const [activeTab, setActiveTab] = useState('questions');
  const [dirty, setDirty] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pendingNav = useRef(null);
  const toast = useToast();

  // Unsaved changes guard — beforeunload
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Mark dirty on any exam change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    if (!loadingExam) setDirty(true);
  }, [exam, loadingExam]);

  const confirmLeave = () => {
    setShowLeaveConfirm(false);
    if (pendingNav.current) {
      navigate(pendingNav.current);
      pendingNav.current = null;
    }
  };

  const cancelLeave = () => {
    setShowLeaveConfirm(false);
    pendingNav.current = null;
  };

  const safeNavigate = (path) => {
    if (dirty) {
      setShowLeaveConfirm(true);
      pendingNav.current = path;
    } else {
      navigate(path);
    }
  };

  // Load existing exam when editing
  useEffect(() => {
    if (!isEditing) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
    setLoadingExam(true);
    examsApi.get(id)
      .then(data => {
        if (!alive) return;
        const questions = (data.exam_questions || []).map(eq => normalizeLoadedQuestion(eq, eq));
        setExam({
          title: data.title || '',
          description: data.description || '',
          duration_minutes: data.duration_minutes ?? null,
          maxAttempts: data.max_attempts ?? null,
          questions,
          showNota: data.show_score ?? true,
          showResp: data.show_answers ?? false,
          showExpl: data.show_explanations ?? false,
        });
      })
      .catch(e => { if (alive) toast.error(`Error al cargar el examen: ${e.message}`); })
      .finally(() => { if (alive) setLoadingExam(false); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally constrained
  }, [id, isEditing]);

  const addQuestion = (type) => {
    const newQ = {
      id: uid('q'),
      type,
      text: '',
      options: type === 'single_choice' || type === 'multiple_choice'
        ? [{ id: uid('opt'), text: '' }, { id: uid('opt'), text: '' }]
        : undefined,
      correct: type === 'boolean' ? true : null,
      correctKey: type === 'single_choice' || type === 'multiple_choice' ? 'A' : null,
      correctAnswer: '',
      explanation: '',
      points: 1,
      difficulty: 'medium',
    };
    setExam(prev => ({ ...prev, questions: [...prev.questions, newQ] }));
  };

  const updateQuestion = (index, updated) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? updated : q),
    }));
  };

  const deleteQuestion = (index) => {
    setExam(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!exam.title.trim()) {
      toast.error('El título del examen es requerido');
      return;
    }
    if (exam.questions.length === 0) {
      toast.error('Agrega al menos una pregunta');
      return;
    }

    setSaving(true);
    try {
      // 1. Save questions sequentially — stops on first failure so we don't create extra orphans
      const savedQuestions = [];
      for (let i = 0; i < exam.questions.length; i++) {
        const q = exam.questions[i];
        const payload = mapQuestionToApi(q);
        const saved = q._questionId
          ? await questionsApi.update(q._questionId, payload)
          : await questionsApi.create(payload);
        savedQuestions.push({ id: saved.id, order: i + 1, points: q.points || 1 });
      }

      // 2. Create or update the exam
      const examPayload = {
        title: exam.title.trim(),
        description: exam.description,
        duration_minutes: exam.duration_minutes,
        max_attempts: exam.maxAttempts,
        show_score: exam.showNota,
        show_answers: exam.showResp,
        show_explanations: exam.showExpl,
      };

      let savedExam;
      if (isEditing) {
        savedExam = await examsApi.update(id, examPayload);
      } else {
        savedExam = await examsApi.create(examPayload);
      }

      // 3. Associate questions with the exam (get_or_create is idempotent)
      await Promise.all(
        savedQuestions.map(q =>
          examsApi.addQuestion(savedExam.id, q.id, q.order, q.points)
        )
      );

      setDirty(false);
      toast.success(isEditing ? 'Examen actualizado' : 'Examen creado');
      navigate('/teacher/exams');
    } catch (e) {
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'questions', label: 'Preguntas', icon: <Icon name="book" size={14} /> },
    { key: 'settings', label: 'Configuración', icon: <Icon name="settings" size={14} /> },
  ];

  if (loadingExam) {
    return (
      <div>
        <PageHead
          breadcrumb={['Exámenes', 'Editar']}
          title="Cargando examen…"
        />
        <div className="p-6 flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        breadcrumb={['Exámenes', isEditing ? 'Editar' : 'Nuevo']}
        title={isEditing ? 'Editar Examen' : 'Nuevo Examen'}
        subtitle={`${exam.questions.length} preguntas`}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => safeNavigate('/teacher/exams')}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : (isEditing ? 'Guardar cambios' : 'Crear examen')}
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl">
        <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} className="mb-6" />

        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Título del examen */}
            <Card>
              <Input
                label="Título del examen"
                value={exam.title}
                onChange={e => setExam({ ...exam, title: e.target.value })}
                placeholder="Ej: Examen de Matemáticas - Unidad 3"
              />
              <Input
                label="Descripción (opcional)"
                value={exam.description}
                onChange={e => setExam({ ...exam, description: e.target.value })}
                placeholder="Instrucciones o descripción del examen"
                className="mt-4"
              />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Input
                  label="Duración (minutos)"
                  type="number"
                  value={exam.duration_minutes || ''}
                  onChange={e => { const v = parseInt(e.target.value); setExam({ ...exam, duration_minutes: v > 0 ? v : null }); }}
                  placeholder="Sin límite"
                  min="1"
                  helper="Dejar vacío para sin límite de tiempo"
                />
                <Input
                  label="Intentos máximos"
                  type="number"
                  value={exam.maxAttempts || ''}
                  onChange={e => { const v = parseInt(e.target.value); setExam({ ...exam, maxAttempts: v > 0 ? v : null }); }}
                  placeholder="Ilimitado"
                  min="1"
                  helper="Dejar vacío para intentos ilimitados"
                />
              </div>
            </Card>

            {/* Preguntas */}
            {exam.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                onUpdate={updated => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
              />
            ))}

            {/* Agregar pregunta */}
            <Card className="border-dashed">
              <div className="text-center py-4">
                <p className="text-sm text-fg-2 mb-4">Agregar pregunta</p>
                <div className="flex justify-center gap-3 flex-wrap">
                  {QUESTION_TYPES.map(t => (
                    <Button
                      key={t.key}
                      variant="secondary"
                      size="sm"
                      icon={<Icon name={t.icon} size={12} />}
                      onClick={() => addQuestion(t.key)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <Card title="Mostrar al finalizar" subtitle="Qué información verá el alumno al terminar">
              <div className="space-y-3">
                <Toggle
                  checked={exam.showNota}
                  onChange={v => setExam({ ...exam, showNota: v })}
                  label="Mostrar nota/calificación"
                />
                <Toggle
                  checked={exam.showResp}
                  onChange={v => setExam({ ...exam, showResp: v })}
                  label="Mostrar respuestas correctas"
                />
                <Toggle
                  checked={exam.showExpl}
                  onChange={v => setExam({ ...exam, showExpl: v })}
                  label="Mostrar explicaciones"
                />
              </div>
            </Card>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showLeaveConfirm}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar. Si sales ahora, perderás todo el progreso."
        confirmLabel="Salir sin guardar"
        confirmVariant="danger"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}

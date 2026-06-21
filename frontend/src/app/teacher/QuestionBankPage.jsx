/**
 * QuestionBankPage.jsx — Banco de preguntas reutilizables
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Input, Skeleton } from '../../design-system';
import { ConfirmModal } from '../../features/shared/ConfirmModal';
import { useToast } from '../../features/toast/ToastProvider';
import { useDebounce } from '../../hooks';
import { questions as questionsApi } from '../../services/api';

const TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: 'Opción múltiple', variant: 'accent' },
  BOOLEAN: { label: 'V/F', variant: 'neutral' },
  SHORT_ANSWER: { label: 'Respuesta corta', variant: 'warning' },
  single_choice: { label: 'Opción múltiple', variant: 'accent' },
  multiple_choice: { label: 'Selección múltiple', variant: 'accent' },
  boolean: { label: 'V/F', variant: 'neutral' },
  short_answer: { label: 'Respuesta corta', variant: 'warning' },
};

const DIFFICULTY_LABELS = {
  easy: { label: 'Fácil', variant: 'success' },
  medium: { label: 'Media', variant: 'warning' },
  hard: { label: 'Difícil', variant: 'danger' },
};

function normalize(q) {
  return {
    id: q.id,
    text: q.text ?? q.question_text ?? '',
    type: q.question_type ?? q.type ?? 'MULTIPLE_CHOICE',
    topic: q.category ?? q.topic ?? q.metadata?.topic ?? q.metadata?.category ?? '—',
    difficulty: q.difficulty ?? q.metadata?.difficulty ?? 'medium',
    usage_count: q.usage_count ?? 0,
    error_rate: q.error_rate != null ? Math.round(q.error_rate) : 0,
  };
}

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(null);       // id de pregunta con menú abierto
  const [confirmDelete, setConfirmDelete] = useState(null); // id a eliminar
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editingQ, setEditingQ] = useState(null);       // pregunta en edición
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);
  const mountedRef = useRef(true);
  const toast = useToast();

  const debouncedSearch = useDebounce(search, 300);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await questionsApi.list();
      if (!mountedRef.current) return;
      const list = Array.isArray(data) ? data : (data.results ?? []);
      const normalized = list.map(normalize);
      setQuestions(normalized);
      const uniqueTopics = [...new Set(normalized.map(q => q.topic).filter(t => t && t !== '—'))];
      setTopics(uniqueTopics);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (topicFilter !== 'all' && q.topic !== topicFilter) return false;
      if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
      if (debouncedSearch && !q.text.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
  }, [questions, topicFilter, difficultyFilter, debouncedSearch]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(q => q.id)));
  };

  const deleteSelected = async () => {
    setBulkDeleteOpen(false);
    const results = await Promise.allSettled([...selected].map(id => questionsApi.delete(id)));
    const ids = [...selected];
    const deletedIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    const failed = results.filter(r => r.status === 'rejected');
    if (deletedIds.size > 0) {
      setQuestions(prev => prev.filter(q => !deletedIds.has(q.id)));
      setSelected(prev => { const next = new Set(prev); deletedIds.forEach(id => next.delete(id)); return next; });
      toast.success(`${deletedIds.size} pregunta${deletedIds.size !== 1 ? 's' : ''} eliminada${deletedIds.size !== 1 ? 's' : ''}`);
    }
    if (failed.length > 0) {
      toast.error(failed[0].reason?.message || 'Algunas preguntas no pudieron eliminarse.');
    }
  };

  const openEdit = async (q) => {
    setMenuOpen(null);
    try {
      const full = await questionsApi.get(q.id);
      setEditForm({
        question_text: full.question_text ?? full.text ?? q.text,
        topic:       full.metadata?.topic ?? full.metadata?.category ?? q.topic,
        difficulty:  full.metadata?.difficulty ?? q.difficulty,
      });
      setEditingQ({ ...q, metadata: full.metadata ?? {} });
    } catch {
      setEditForm({ question_text: q.text, topic: q.topic, difficulty: q.difficulty });
      setEditingQ({ ...q, metadata: {} });
    }
  };

  const saveEdit = async () => {
    if (!editingQ) return;
    setSaving(true);
    try {
      await questionsApi.update(editingQ.id, {
        question_text: editForm.question_text,
        metadata: { ...editingQ.metadata, topic: editForm.topic, difficulty: editForm.difficulty },
      });
      setQuestions(prev => prev.map(q =>
        q.id === editingQ.id
          ? { ...q, text: editForm.question_text, topic: editForm.topic, difficulty: editForm.difficulty }
          : q
      ));
      setEditingQ(null);
      toast.success('Pregunta actualizada');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await questionsApi.delete(confirmDelete);
      setQuestions(prev => prev.filter(q => q.id !== confirmDelete));
      toast.success('Pregunta eliminada');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const stats = useMemo(() => ({
    total: questions.length,
    lowError: questions.filter(q => q.error_rate < 30).length,
    highError: questions.filter(q => q.error_rate >= 50).length,
    critical: questions.filter(q => q.error_rate >= 70).length,
  }), [questions]);

  return (
    <div>
      <PageHead
        breadcrumb={['Banco de preguntas']}
        title="Banco de preguntas"
        subtitle={`${questions.length} preguntas en total`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={13} />} onClick={load}>
              Actualizar
            </Button>
            <Button icon={<Icon name="plus" size={14} />} onClick={() => navigate('/teacher/exams/new?tab=questions')}>
              Agregar pregunta
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {error && (
              <div className="flex items-center justify-between p-3 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={load}>Reintentar</Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                <Icon name="book" size={18} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.total}</div>
                <div className="text-xs text-fg-2">Total preguntas</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ok/10">
                <Icon name="check" size={18} className="text-ok" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.lowError}</div>
                <div className="text-xs text-fg-2">Bajo error</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10">
                <Icon name="trend" size={18} className="text-warn" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.highError}</div>
                <div className="text-xs text-fg-2">Alto error</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-danger/10">
                <Icon name="info" size={18} className="text-danger" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{stats.critical}</div>
                <div className="text-xs text-fg-2">Críticas</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar preguntas..."
              className="w-64"
            />
            <select
              value={topicFilter}
              onChange={e => setTopicFilter(e.target.value)}
              className="bg-transparent border-2 border-line rounded-xl px-3 py-2.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
            >
              <option value="all">Todos los temas</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
              className="bg-transparent border-2 border-line rounded-xl px-3 py-2.5 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
            >
              <option value="all">Todas las dificultades</option>
              <option value="easy">Fácil</option>
              <option value="medium">Media</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-fg-2">{selected.size} seleccionadas</span>
              <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)} icon={<Icon name="trash" size={12} />}>
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="48px" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="search" size={48} className="text-fg-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">
                {questions.length === 0 ? 'Banco vacío' : 'Sin resultados'}
              </h3>
              <p className="text-sm text-fg-2">
                {questions.length === 0
                  ? 'Importa preguntas o crea un examen para agregar preguntas al banco'
                  : 'Intenta con otros filtros'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-10 px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Pregunta</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Tipo</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Tema</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Dificultad</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Uso</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">% Error</th>
                  <th className="w-10 px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const type = TYPE_LABELS[q.type] || TYPE_LABELS.MULTIPLE_CHOICE;
                  const diff = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.medium;
                  return (
                    <tr key={q.id} className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(q.id)}
                          onChange={() => toggleSelect(q.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-fg-0 max-w-md truncate">{q.text}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={type.variant}>{type.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-1">{q.topic}</td>
                      <td className="px-4 py-3">
                        <Badge variant={diff.variant}>{diff.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-1">{q.usage_count} exámenes</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${q.error_rate >= 70 ? 'text-danger' : q.error_rate >= 50 ? 'text-warn' : 'text-ok'}`}>
                          {q.error_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3" ref={menuOpen === q.id ? menuRef : null}>
                        <div className="relative">
                          <Button
                            variant="ghost" size="sm"
                            onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === q.id ? null : q.id); }}
                          >
                            <Icon name="more" size={14} />
                          </Button>
                          {menuOpen === q.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-36 bg-bg-1 border border-line rounded-xl shadow-pop py-1">
                              <button
                                className="w-full text-left px-3 py-1.5 text-sm text-fg-1 hover:bg-bg-2 transition-colors"
                                onClick={() => openEdit(q)}
                              >
                                Editar
                              </button>
                              <button
                                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                                onClick={() => { setMenuOpen(null); setConfirmDelete(q.id); }}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Modal: eliminar pregunta individual */}
      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar pregunta"
        message="¿Seguro que deseas eliminar esta pregunta? Esta acción no se puede deshacer."
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Modal: eliminar seleccionadas */}
      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Eliminar ${selected.size} pregunta${selected.size !== 1 ? 's' : ''}`}
        message={`¿Seguro que deseas eliminar ${selected.size} pregunta${selected.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={deleteSelected}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Modal: editar pregunta */}
      {editingQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingQ(null)}>
          <div className="bg-bg-1 border border-line rounded-2xl p-6 max-w-lg w-full shadow-pop space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-fg-0 font-semibold">Editar pregunta</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-fg-3 mb-1.5">Enunciado</label>
                <textarea
                  rows={3}
                  value={editForm.question_text}
                  onChange={e => setEditForm(f => ({ ...f, question_text: e.target.value }))}
                  className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-fg-3 mb-1.5">Tema</label>
                  <input
                    value={editForm.topic}
                    onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                    className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fg-3 mb-1.5">Dificultad</label>
                  <select
                    value={editForm.difficulty}
                    onChange={e => setEditForm(f => ({ ...f, difficulty: e.target.value }))}
                    className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent transition-colors"
                  >
                    <option value="easy">Fácil</option>
                    <option value="medium">Media</option>
                    <option value="hard">Difícil</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditingQ(null)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

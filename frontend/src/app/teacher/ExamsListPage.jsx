/**
 * ExamsListPage.jsx — Lista de exámenes con cards
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Card, Input, Skeleton } from '../../design-system';
import { useToast } from '../../features/toast/ToastProvider';
import { useDebounce } from '../../hooks';
import { exams as examsApi } from '../../services/api';
import ExamCard from '../../features/exams/ExamCard';
import { ConfirmModal } from '../../features/shared/ConfirmModal';
import { formatRelative } from '../../utils/formatters';


function normalize(e) {
  const status = e.archived ? 'archived' : e.is_published ? 'published' : 'draft';
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    status,
    questions: e.questions_count ?? 0,
    duration: e.duration_minutes ? `${e.duration_minutes} min` : null,
    attempts: e.attempts_count ?? 0,
    avg: e.avg_score != null ? Math.round(e.avg_score * 5) : 0,
    passRate: e.pass_rate != null ? Math.round(e.pass_rate) : 0,
    lastActivity: formatRelative(e.last_activity_at),
    maxAttempts: e.max_attempts ?? null,
    showNota: e.show_score ?? true,
    showResp: e.show_answers ?? false,
    showExpl: e.show_explanations ?? false,
  };
}

export default function ExamsListPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null); // exam pending delete
  const [deleting, setDeleting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await examsApi.list({ include_archived: true });
      const list = Array.isArray(data) ? data : (data.results ?? []);
      if (mountedRef.current) setExams(list.map(normalize));
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
  useEffect(() => { load(); }, [load]);

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (filter === 'all' && e.status === 'archived') return false;
      if (filter !== 'all' && e.status !== filter) return false;
      if (debouncedSearch && !e.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });
  }, [exams, filter, debouncedSearch]);

  const handleCopyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/exam/${slug}`);
      toast.success('Enlace copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const handleEdit = (exam) => navigate(`/teacher/exams/${exam.id}/edit`);

  const handleDelete = (exam) => {
    setDeleteTarget(exam);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await examsApi.delete(deleteTarget.id, (deleteTarget.attempts || 0) > 0);
      setExams(prev => prev.filter(e => e.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" eliminado`);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (exam) => {
    try {
      await examsApi.archive(exam.id);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: 'archived' } : e));
      toast.success(`"${exam.title}" archivado`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUnarchive = async (exam) => {
    try {
      await examsApi.unarchive(exam.id);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: 'draft' } : e));
      toast.success(`"${exam.title}" desarchivado`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePublish = async (exam) => {
    try {
      await examsApi.publish(exam.id);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: 'published' } : e));
      toast.success(`"${exam.title}" publicado`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUnpublish = async (exam) => {
    try {
      await examsApi.unpublish(exam.id);
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: 'draft' } : e));
      toast.success(`"${exam.title}" despublicado`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDuplicate = async (exam) => {
    try {
      const copy = await examsApi.duplicate(exam.id);
      setExams(prev => [normalize(copy), ...prev]);
      toast.success(`Copia de "${exam.title}" creada`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleChange = useCallback(async (id, values) => {
    try {
      await examsApi.update(id, values);
      setExams(prev => prev.map(e => e.id === id ? {
        ...e,
        showNota: values.show_score ?? e.showNota,
        showResp: values.show_answers ?? e.showResp,
        showExpl: values.show_explanations ?? e.showExpl,
      } : e));
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const filters = [
    { key: 'all', label: 'Todos', count: exams.filter(e => e.status !== 'archived').length },
    { key: 'published', label: 'Publicados', count: exams.filter(e => e.status === 'published').length },
    { key: 'draft', label: 'Borradores', count: exams.filter(e => e.status === 'draft').length },
    { key: 'archived', label: 'Archivados', count: exams.filter(e => e.status === 'archived').length },
  ];

  return (
    <div>
      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar examen"
        message={deleteTarget
          ? ((deleteTarget.attempts || 0) > 0
              ? `"${deleteTarget.title}" tiene ${deleteTarget.attempts} intento(s). Se eliminarán también sus resultados. Esta acción no se puede deshacer.`
              : `¿Eliminar "${deleteTarget.title}"? Esta acción no se puede deshacer.`)
          : ''}
        confirmLabel={deleting ? 'Eliminando…' : 'Eliminar'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <PageHead
        breadcrumb={['Exámenes']}
        title="Exámenes"
        subtitle={`${exams.length} exámenes en total`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={13} />} onClick={load}>
              Actualizar
            </Button>
            <Button icon={<Icon name="plus" size={14} />} onClick={() => navigate('/teacher/exams/new')}>
              Nuevo examen
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

        <div className="flex items-center justify-between gap-4">
          <div className="flex rounded-xl border border-line overflow-hidden">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f.key ? 'bg-accent text-bg-1' : 'text-fg-2 hover:text-fg-0 hover:bg-accent-soft'
                }`}
              >
                {f.label}
                  <span className={`ml-1.5 text-xs ${filter === f.key ? 'text-bg-1/70' : 'text-fg-3'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar exámenes..."
            className="w-64"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} padding="md">
                <Skeleton width="60%" height="20px" className="mb-4" />
                <Skeleton width="100%" height="60px" className="mb-4" />
                <Skeleton width="100%" height="40px" />
              </Card>
            ))}
          </div>
        ) : filteredExams.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-12">
              <Icon name="book" size={48} className="text-fg-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">
                {search ? 'Sin resultados' : 'No hay exámenes'}
              </h3>
              <p className="text-sm text-fg-2 mb-4">
                {search ? 'Intenta con otro término de búsqueda' : 'Crea tu primer examen para comenzar'}
              </p>
              {!search && (
                <Button icon={<Icon name="plus" size={14} />} onClick={() => navigate('/teacher/exams/new')}>
                  Crear examen
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map(exam => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onCopyLink={handleCopyLink}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                onDuplicate={handleDuplicate}
                onToggleChange={handleToggleChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

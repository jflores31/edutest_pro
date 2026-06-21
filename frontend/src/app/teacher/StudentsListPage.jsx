/**
 * StudentsListPage.jsx — Lista de alumnos con filtros y acciones
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Input, Avatar, Skeleton } from '../../design-system';
import { students as studentsApi, courses as coursesApi } from '../../services/api';
import { formatRelative } from '../../utils/formatters';

function EditStudentModal({ student, courses, onSave, onClose }) {
  const [form, setForm] = useState({
    first_name: student.firstName,
    last_name:  student.lastName,
    code:       student.code,
    course:     student.courseId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-bg-1 border border-line rounded-2xl p-6 max-w-md w-full shadow-pop space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-fg-0 font-semibold text-base">Editar alumno</h3>
        {error && <p className="text-danger text-xs bg-danger/5 border border-danger/20 rounded-xl px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          <Input label="Apellido" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>
        <Input label="DNI / Código" value={form.code} onChange={e => set('code', e.target.value)} monospace />
        <div>
          <label className="block text-xs font-medium text-fg-1 mb-1">Curso</label>
          <select value={form.course} onChange={e => set('course', e.target.value)}
            className="w-full bg-transparent border-2 border-line rounded-xl px-3 py-2 text-sm text-fg-0 outline-none focus:border-accent transition-colors">
            <option value="">Sin curso</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-line">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}


function normalize(s) {
  return {
    id: s.id,
    code: s.code ?? s.dni ?? '—',
    firstName: s.first_name ?? '',
    lastName: s.last_name ?? '',
    email: s.email ?? '',
    course: s.course_name ?? s.course?.name ?? '—',
    courseId: s.course?.id ?? s.course_id ?? null,
    attempts: s.attempts_count ?? 0,
    avgScore: s.avg_score != null ? Math.round(s.avg_score * 5) : 0,
    lastActivity: formatRelative(s.last_activity_at),
  };
}

const AVATAR_COLORS = [
  'bg-accent-soft text-accent',
  'bg-ok-soft text-ok',
  'bg-warn-soft text-warn',
  'bg-danger-soft text-danger',
  'bg-bg-3 text-fg-2',
  'bg-accent-soft text-accent',
];

export default function StudentsListPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [editStudent, setEditStudent] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentsData, coursesData] = await Promise.all([
        studentsApi.list(),
        coursesApi.list().catch(() => []),
      ]);
      if (!mountedRef.current) return;
      const list = Array.isArray(studentsData) ? studentsData : (studentsData.results ?? []);
      setStudents(list.map(normalize));
      const cList = Array.isArray(coursesData) ? coursesData : (coursesData.results ?? []);
      setCourseOptions(cList);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional synchronous state update in this effect
  useEffect(() => { load(); }, [load]);

  async function saveEdit(data) {
    await studentsApi.update(editStudent.id, data);
    const courseName = courseOptions.find(c => String(c.id) === String(data.course))?.name ?? '—';
    setStudents(prev => prev.map(s =>
      s.id === editStudent.id
        ? { ...s, firstName: data.first_name, lastName: data.last_name, code: data.code,
            course: courseName, courseId: data.course ? Number(data.course) : null }
        : s
    ));
    setEditStudent(null);
  }

  const filtered = useMemo(() => {
    return students.filter(s => {
      if (courseFilter !== 'all' && s.courseId !== Number(courseFilter) && s.course !== courseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.code.toLowerCase().includes(q) ||
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, search, courseFilter]);

  const avgScore = useMemo(() => {
    if (students.length === 0) return 0;
    return Math.round(students.reduce((sum, s) => sum + s.avgScore, 0) / students.length);
  }, [students]);

  return (
    <div>
      <PageHead
        breadcrumb={['Alumnos']}
        title="Alumnos"
        subtitle={`${students.length} alumnos registrados`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={13} />} onClick={load}>
              Actualizar
            </Button>
            <Button icon={<Icon name="upload" size={14} />} onClick={() => navigate('/teacher/import')}>
              Importar alumnos
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                <Icon name="users" size={18} className="text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{students.length}</div>
                <div className="text-xs text-fg-2">Alumnos totales</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ok/10">
                <Icon name="award" size={18} className="text-ok" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{avgScore}%</div>
                <div className="text-xs text-fg-2">Promedio general</div>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10">
                <Icon name="book" size={18} className="text-warn" />
              </div>
              <div>
                <div className="text-2xl font-bold text-fg-0">{courseOptions.length}</div>
                <div className="text-xs text-fg-2">Cursos activos</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex rounded-xl border border-line overflow-hidden">
            <button
              onClick={() => setCourseFilter('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                courseFilter === 'all' ? 'bg-accent text-bg-1' : 'text-fg-2 hover:text-fg-0 hover:bg-accent-soft'
              }`}
            >
              Todos
            </button>
            {courseOptions.map(c => (
              <button
                key={c.id}
                onClick={() => setCourseFilter(String(c.id))}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  courseFilter === String(c.id) ? 'bg-accent text-bg-1' : 'text-fg-2 hover:text-fg-0 hover:bg-accent-soft'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI o email..."
            className="w-72"
          />
        </div>

        {/* Table */}
        <Card padding="none">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="40px" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Alumno</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">DNI</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Curso</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Intentos</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Promedio</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Última actividad</th>
                  <th className="text-right text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} onClick={() => navigate(`/teacher/students/${s.id}`)} className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={`${s.firstName} ${s.lastName}`}
                          size="sm"
                          color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                        />
                        <div>
                          <div className="text-sm font-medium text-fg-0">{s.firstName} {s.lastName}</div>
                          <div className="text-2xs text-fg-3">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-fg-1">{s.code}</td>
                    <td className="px-4 py-3 text-sm text-fg-1">{s.course}</td>
                    <td className="px-4 py-3 text-sm text-fg-1">{s.attempts}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.avgScore >= 55 ? 'success' : s.avgScore >= 40 ? 'warning' : 'danger'}>
                        {s.avgScore}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg-2">{s.lastActivity}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEditStudent(s); }}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); navigate(`/teacher/students/${s.id}`); }}>
                          <Icon name="chevron-right" size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12">
              <Icon name="users" size={48} className="text-fg-3 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-fg-0 mb-2">Sin resultados</h3>
              <p className="text-sm text-fg-2">
                {students.length === 0 ? 'No hay alumnos registrados aún' : 'Intenta con otros filtros'}
              </p>
              {students.length === 0 && (
                <Button
                  className="mt-4"
                  icon={<Icon name="upload" size={14} />}
                  onClick={() => navigate('/teacher/import')}
                >
                  Importar alumnos
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {editStudent && (
        <EditStudentModal
          student={editStudent}
          courses={courseOptions}
          onSave={saveEdit}
          onClose={() => setEditStudent(null)}
        />
      )}
    </div>
  );
}

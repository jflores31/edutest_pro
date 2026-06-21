import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../layout';
import { Button, Icon, Badge, Card, Input, Tabs, Toggle, Skeleton } from '../../design-system';
import { auth, courses as coursesApi, integrations as integrationsApi, notifications as notificationsApi, templates as templatesApi } from '../../services/api';
import { ConfirmModal } from '../../features/shared/ConfirmModal';

const TABS = [
  { key: 'cuenta', label: 'Cuenta', icon: <Icon name="user" size={14} /> },
  { key: 'cursos', label: 'Cursos', icon: <Icon name="book" size={14} /> },
  { key: 'integraciones', label: 'Integraciones', icon: <Icon name="plug" size={14} /> },
  { key: 'notificaciones', label: 'Notificaciones', icon: <Icon name="bell" size={14} /> },
  { key: 'plantillas', label: 'Plantillas', icon: <Icon name="template" size={14} /> },
];


// ============================================================
// TAB: CUENTA
// ============================================================
function AccountTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [pwd, setPwd] = useState({ current: '', next: '' });

  useEffect(() => {
    let alive = true;
    auth.me()
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ first_name: '', last_name: '', email: '', institution: '' }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function validate() {
    const e = {};
    if (!data.first_name?.trim()) e.first_name = 'Nombre requerido';
    if (!data.last_name?.trim()) e.last_name = 'Apellido requerido';
    if (!data.email?.trim()) e.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const updated = await auth.updateMe({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim(),
      });
      setData(updated);
      setSavedMsg('Guardado correctamente');
    } catch (e) {
      setSavedMsg('Error: ' + (e.message || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!pwd.current || !pwd.next) {
      setSavedMsg('Completa ambos campos de contraseña');
      return;
    }
    if (pwd.next.length < 8) {
      setSavedMsg('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setChangingPwd(true);
    setSavedMsg('');
    try {
      await auth.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '' });
      setSavedMsg('Contraseña actualizada');
    } catch (e) {
      setSavedMsg('Error: ' + (e.message || 'No se pudo cambiar la contraseña'));
    } finally {
      setChangingPwd(false);
    }
  }

  if (loading || !data) return <Skeleton height="200px" />;

  return (
    <div className="space-y-4">
      <Card title="Información personal" subtitle="Actualiza tus datos de perfil">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre" value={data.first_name} onChange={e => { setData({ ...data, first_name: e.target.value }); setErrors({ ...errors, first_name: undefined }); }} error={errors.first_name} maxLength={80} />
          <Input label="Apellido" value={data.last_name} onChange={e => { setData({ ...data, last_name: e.target.value }); setErrors({ ...errors, last_name: undefined }); }} error={errors.last_name} maxLength={80} />
          <Input label="Correo electrónico" type="email" value={data.email} onChange={e => { setData({ ...data, email: e.target.value }); setErrors({ ...errors, email: undefined }); }} error={errors.email} maxLength={255} />
          <Input label="Institución" value={data.institution || ''} onChange={e => setData({ ...data, institution: e.target.value })} maxLength={120} />
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
          {savedMsg && <span className={`text-xs ${savedMsg.startsWith('Error') ? 'text-danger' : 'text-ok'}`}>{savedMsg}</span>}
          {!savedMsg && <span />}
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </Card>

      <Card title="Cambiar contraseña" subtitle="Actualiza tu contraseña de acceso">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contraseña actual" type="password" value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} maxLength={128} />
          <Input label="Nueva contraseña" type="password" value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} helper="Mínimo 8 caracteres" maxLength={128} />
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t border-line">
          <Button variant="secondary" onClick={changePassword} disabled={changingPwd}>{changingPwd ? 'Actualizando…' : 'Cambiar contraseña'}</Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// TAB: CURSOS
// ============================================================
function CoursesTab() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => {
    let alive = true;
    coursesApi.list()
      .then(d => { if (alive) setCourses(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function openNew() { setEditing(null); setForm({ name: '', code: '' }); setFormErrors({}); setShowModal(true); }
  function openEdit(course) { setEditing(course); setForm({ name: course.name, code: course.code }); setFormErrors({}); setShowModal(true); }

  function validateForm() {
    const e = {};
    if (!form.name?.trim()) e.name = 'Nombre requerido';
    if (!form.code?.trim()) e.code = 'Código requerido';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await coursesApi.update(editing.id, { name: form.name.trim(), code: form.code.trim() });
        setCourses(prev => prev.map(c => c.id === editing.id ? { ...c, ...updated } : c));
      } else {
        const created = await coursesApi.create({ name: form.name.trim(), code: form.code.trim() });
        setCourses(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (e) {
      setDeleteMsg('Error al guardar: ' + (e.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(course) {
    try {
      await coursesApi.delete(course.id);
      setCourses(prev => prev.filter(c => c.id !== course.id));
    } catch (e) {
      setDeleteMsg('Error al eliminar: ' + (e.message || 'Error desconocido'));
    }
    setDeleteTarget(null);
  }

  if (loading) return <Skeleton height="200px" />;

  return (
    <div className="space-y-4">
      {deleteMsg && !deleteTarget && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-3 py-2 rounded-xl">{deleteMsg}</div>
      )}
      <Card title="Cursos" subtitle={`${courses.length} cursos registrados`} headerAction={<Button size="sm" icon={<Icon name="plus" size={12} />} onClick={openNew}>Nuevo curso</Button>} padding="none">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Nombre</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Código</th>
                  <th className="text-left text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Alumnos</th>
                  <th className="text-right text-xs text-fg-3 font-semibold uppercase tracking-wider px-5 py-3.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id} className="border-b border-line/40 last:border-0 hover:bg-bg-2/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-fg-0">{c.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-fg-1">{c.code}</td>
                <td className="px-4 py-3"><Badge variant="neutral">{c.students_count ?? 0} alumnos</Badge></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Icon name="edit" size={14} /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(c); setDeleteMsg(''); }}><Icon name="trash" size={14} className="text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog" aria-modal="true"
          onClick={() => setShowModal(false)}
          onKeyDown={e => { if (e.key === 'Escape') setShowModal(false); }}
        >
          <div className="bg-bg-1 border border-line rounded-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-fg-0 mb-4">{editing ? 'Editar curso' : 'Nuevo curso'}</h3>
            <div className="space-y-4">
              <Input label="Nombre" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors({ ...formErrors, name: undefined }); }} error={formErrors.name} maxLength={120} />
              <Input label="Código" value={form.code} onChange={e => { setForm({ ...form, code: e.target.value }); setFormErrors({ ...formErrors, code: undefined }); }} error={formErrors.code} maxLength={32} />
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-line">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : (editing ? 'Guardar' : 'Crear')}</Button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar curso"
          message={`¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`}
          onConfirm={() => remove(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// TAB: INTEGRACIONES
// ============================================================
function IntegrationsTab() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState('');

  useEffect(() => {
    let alive = true;
    const fallback = [
      { key: 'google-classroom', name: 'Google Classroom', description: 'Sincroniza cursos y alumnos', connected: false },
      { key: 'microsoft-teams', name: 'Microsoft Teams', description: 'Importa equipos y canales', connected: false },
      { key: 'moodle', name: 'Moodle', description: 'Importa cursos y cuestionarios', connected: false },
    ];
    integrationsApi.list()
      .then(d => { if (alive) setIntegrations(d); })
      .catch(() => { if (alive) setIntegrations(fallback); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleToggle = async (key) => {
    setToggling(key);
    try {
      await integrationsApi.toggle(key);
      setIntegrations(prev => prev.map(int => int.key === key ? { ...int, connected: !int.connected } : int));
    } catch {}
    setToggling('');
  };

  const iconMap = { 'google-classroom': 'cloud', 'microsoft-teams': 'users', 'moodle': 'book' };

  return (
    <div className="space-y-4">
      <Card title="Integraciones" subtitle="Conecta EduTest Pro con otras plataformas">
        <div className="space-y-3">
          {loading ? <Skeleton height="60px" /> : integrations.map(int => (
            <div key={int.key} className="flex items-center justify-between p-4 bg-bg-2 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10"><Icon name={iconMap[int.key] || 'plug'} size={18} className="text-accent" /></div>
                <div>
                  <div className="text-sm font-medium text-fg-0">{int.name}</div>
                  <div className="text-xs text-fg-2">{int.description}</div>
                </div>
              </div>
              <Button variant={int.connected ? 'secondary' : 'primary'} size="sm" disabled={toggling === int.key} onClick={() => handleToggle(int.key)}>
                {toggling === int.key ? 'Conectando…' : (int.connected ? 'Desconectar' : 'Conectar')}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// TAB: NOTIFICACIONES
// ============================================================
const _DEFAULT_PREFS = {
  attempt_finished: true,
  daily_summary: true,
  low_score: true,
  proctoring_alerts: true,
  overdue_attempts: false,
  newsletter: false,
};

function NotificationsTab() {
  const [notifs, setNotifs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    notificationsApi.getPrefs()
      .then(arr => {
        if (!alive) return;
        const flat = Object.fromEntries(arr.map(({ key, on }) => [key, on]));
        setNotifs({ ..._DEFAULT_PREFS, ...flat });
      })
      .catch(() => { if (alive) setNotifs({ ..._DEFAULT_PREFS }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const items = [
    { key: 'attempt_finished',  label: 'Examen completado',       desc: 'Alerta cuando un alumno finaliza un examen',         icon: 'check'  },
    { key: 'low_score',         label: 'Puntaje bajo',             desc: 'Alerta cuando un alumno reprueba (< 11/20)',          icon: 'trend'  },
    { key: 'daily_summary',     label: 'Resumen diario',           desc: 'Resumen de actividad del día',                       icon: 'chart'  },
    { key: 'proctoring_alerts', label: 'Alertas de proctoring',    desc: 'Cambios de pestaña y pérdida de foco detectados',    icon: 'eye'    },
    { key: 'overdue_attempts',  label: 'Intentos abandonados',     desc: 'Intentos sin completar por tiempo agotado',          icon: 'clock'  },
    { key: 'newsletter',        label: 'Novedades de EduTest',     desc: 'Actualizaciones y nuevas funcionalidades',           icon: 'mail'   },
  ];

  async function toggle(key) {
    const prev = { ...notifs };
    const next = !notifs[key];
    setNotifs({ ...notifs, [key]: next });
    try {
      const arr = await notificationsApi.updatePrefs({ [key]: next });
      const flat = Object.fromEntries(arr.map(({ key: k, on }) => [k, on]));
      setNotifs({ ..._DEFAULT_PREFS, ...flat });
    } catch {
      setNotifs(prev);
    }
  }

  if (loading || !notifs) return <Skeleton height="200px" />;

  return (
    <div className="space-y-4">
      <Card title="Preferencias de notificación" subtitle="Configura qué alertas recibir por email">
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent-soft transition-colors">
              <div className="flex items-center gap-3">
                <Icon name={item.icon} size={16} className="text-fg-3" />
                <div>
                  <div className="text-sm text-fg-0">{item.label}</div>
                  <div className="text-xs text-fg-3">{item.desc}</div>
                </div>
              </div>
              <Toggle checked={notifs[item.key] ?? false} onChange={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// TAB: PLANTILLAS
// ============================================================
function TemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    templatesApi.list()
      .then(d => { if (alive) setTemplates(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Card
        title="Plantillas"
        subtitle="Reutiliza configuraciones de exámenes"
        headerAction={<Button size="sm" icon={<Icon name="plus" size={12} />} onClick={() => navigate('/teacher/exams/new')}>Nueva plantilla</Button>}
      >
        {loading ? <div className="p-4"><Skeleton height="60px" /><Skeleton height="60px" /></div> : templates.length === 0 ? (
          <div className="text-center py-8 text-fg-3 text-sm">No hay plantillas aún</div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-bg-2 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10"><Icon name="template" size={18} className="text-accent" /></div>
                  <div>
                    <div className="text-sm font-medium text-fg-0">{t.name}</div>
                    <div className="text-xs text-fg-2">{t.description || `Duración: ${t.duration_minutes} min · ${t.questions_count} preguntas`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{t.questions_count} preg.</Badge>
                  <div className="relative">
                    <Button variant="ghost" size="sm" onClick={() => setShowMenu(showMenu === t.id ? null : t.id)}><Icon name="more" size={14} /></Button>
                    {showMenu === t.id && (
                      <div className="absolute right-0 bottom-full mb-1 w-44 bg-bg-1 border border-line rounded-xl shadow-pop z-10 py-1">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-1 hover:bg-bg-2 transition-colors" onClick={() => { templatesApi.instantiate(t.id).then(() => navigate('/teacher/exams')); setShowMenu(null); }}>
                          <Icon name="play" size={14} /> Usar plantilla
                        </button>
                        <div className="border-t border-line my-1" />
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors" onClick={() => { setDeleteTarget(t); setShowMenu(null); }}>
                          <Icon name="trash" size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {deleteTarget && (
        <ConfirmModal
          title="Eliminar plantilla"
          message={`¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.`}
          onConfirm={async () => { try { await templatesApi.delete(deleteTarget.id); setTemplates(prev => prev.filter(t => t.id !== deleteTarget.id)); } catch {} setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// SETTINGS PAGE
// ============================================================
export default function SettingsPage() {
  const [tab, setTab] = useState('cuenta');

  return (
    <div>
      <PageHead breadcrumb={['Configuración']} title="Configuración" subtitle="Personaliza tu cuenta y los cursos que administras" />
      <div className="p-6 max-w-[1100px]">
        <div className="grid grid-cols-[220px_1fr] gap-6">
          <Tabs tabs={TABS} activeKey={tab} onChange={setTab} orientation="vertical" />
          <div>
            {tab === 'cuenta' && <AccountTab />}
            {tab === 'cursos' && <CoursesTab />}
            {tab === 'integraciones' && <IntegrationsTab />}
            {tab === 'notificaciones' && <NotificationsTab />}
            {tab === 'plantillas' && <TemplatesTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
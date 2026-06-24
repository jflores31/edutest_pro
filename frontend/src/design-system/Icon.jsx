/**
 * Icon.jsx — Wrapper de Lucide React para EduTest Pro
 * @param {string} name - Nombre del icono (mapeo interno)
 * @param {number} size - Tamaño en px (default 16)
 * @param {string} className - Clases CSS adicionales
 * @param {object} style - Estilos inline
 * @param {number} strokeWidth - Grosor del trazo (default 1.6)
 */
import {
  BookOpen,
  BarChart3,
  Upload,
  Plus,
  Play,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  LayoutGrid,
  Rows3,
  RefreshCw,
  Info,
  FileText,
  Download,
  Sparkles,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  AlertTriangle,
  ArrowUp,
  Bell,
  Link,
  Cloud,
  LayoutTemplate,
  X,
  Mail,
  User,
  Plug,
  Pencil,
  Archive,
  MoreHorizontal,
  Sun,
  Moon,
  Monitor,
  Activity,
  Zap,
  Shield,
  Globe,
  Database,
  Wifi,
  WifiOff,
  Send,
  Save,
  Printer,
  Share2,
  Heart,
  Star,
  Home,
  Menu,
  Calendar,
  MapPin,
  Phone,
  MessageSquare,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

const ICONS = {
  // Mapeo de iconos originales de EduTest
  book: BookOpen,
  chart: BarChart3,
  upload: Upload,
  plus: Plus,
  play: Play,
  trash: Trash2,
  copy: Copy,
  check: Check,
  eye: Eye,
  eyeoff: EyeOff,
  clock: Clock,
  users: Users,
  award: Award,
  trend: TrendingUp,
  search: Search,
  filter: Filter,
  grid: LayoutGrid,
  rows: Rows3,
  refresh: RefreshCw,
  info: Info,
  file: FileText,
  download: Download,
  sparkle: Sparkles,
  settings: Settings,
  logout: LogOut,
  chevron: ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  alert: AlertTriangle,
  arrowup: ArrowUp,
  bell: Bell,
  link: Link,
  cloud: Cloud,
  template: LayoutTemplate,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  x: X,
  mail: Mail,
  user: User,
  plug: Plug,
  edit: Pencil,
  archive: Archive,
  more: MoreHorizontal,

  // Iconos adicionales
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  activity: Activity,
  zap: Zap,
  shield: Shield,
  globe: Globe,
  database: Database,
  wifi: Wifi,
  'wifi-off': WifiOff,
  send: Send,
  save: Save,
  printer: Printer,
  share: Share2,
  heart: Heart,
  star: Star,
  home: Home,
  menu: Menu,
  calendar: Calendar,
  'map-pin': MapPin,
  phone: Phone,
  'message-square': MessageSquare,
  help: HelpCircle,
  'external-link': ExternalLink,
};

// Tono de color por icono (alusivo a educación/exámenes). Theme-aware vía
// las variables --color-ic-<tono> / --color-ic-<tono>-soft de tokens.css.
const TONE = {
  // Aprendizaje / contenido → índigo
  book: 'indigo', template: 'indigo', file: 'indigo', mail: 'indigo',
  calendar: 'indigo', home: 'indigo', link: 'indigo', send: 'indigo',
  plus: 'indigo', moon: 'indigo',
  // Analítica → violeta
  chart: 'violet', trend: 'violet', 'trending-up': 'violet', 'trending-down': 'violet',
  activity: 'violet', grid: 'violet', rows: 'violet', arrowup: 'violet',
  // Personas → teal
  users: 'teal', user: 'teal', globe: 'teal', share: 'teal',
  // Logros / atención → ámbar
  award: 'amber', star: 'amber', sparkle: 'amber', archive: 'amber',
  alert: 'amber', sun: 'amber',
  // Datos / entrada-salida → cielo
  upload: 'sky', download: 'sky', cloud: 'sky', database: 'sky', save: 'sky',
  printer: 'sky', copy: 'sky', plug: 'sky', 'external-link': 'sky',
  wifi: 'sky', 'wifi-off': 'sky',
  // Éxito / seguridad → esmeralda
  check: 'emerald', shield: 'emerald', eye: 'emerald', eyeoff: 'emerald', play: 'emerald',
  // En vivo / monitoreo / alertas → rosa
  bell: 'rose', monitor: 'rose', heart: 'rose', phone: 'rose',
  'message-square': 'rose', 'map-pin': 'rose', zap: 'rose', trash: 'rose',
  // Controles / neutro → slate
  settings: 'slate', edit: 'slate', filter: 'slate', search: 'slate', more: 'slate',
  menu: 'slate', x: 'slate', info: 'slate', help: 'slate', refresh: 'slate', logout: 'slate',
  chevron: 'slate', 'chevron-up': 'slate', 'chevron-down': 'slate',
  'chevron-left': 'slate', 'chevron-right': 'slate',
};

export default function Icon({
  name,
  size = 16,
  className = '',
  style = {},
  strokeWidth = 1.6,
  variant = 'plain', // 'plain' (currentColor) | 'soft' (trazo a color de tono) | 'chip' (icono coloreado en fondo suave)
  tone,              // fuerza un tono; si no, usa TONE[name]
  ...props
}) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;

  const t = tone || TONE[name] || 'slate';
  const toneColor = `var(--color-ic-${t})`;

  if (variant === 'chip') {
    const pad = Math.round(size * 0.5);
    return (
      <span
        className={`inline-grid place-items-center rounded-xl ${className}`}
        style={{ background: `var(--color-ic-${t}-soft)`, padding: `${pad}px`, ...style }}
      >
        <Cmp size={size} strokeWidth={strokeWidth} style={{ color: toneColor }} {...props} />
      </span>
    );
  }

  return (
    <Cmp
      size={size}
      className={className}
      style={variant === 'soft' ? { color: toneColor, ...style } : style}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

export { ICONS, TONE };

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

export default function Icon({
  name,
  size = 16,
  className = '',
  style = {},
  strokeWidth = 1.6,
  ...props
}) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;

  return (
    <Cmp
      size={size}
      className={className}
      style={style}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

export { ICONS };

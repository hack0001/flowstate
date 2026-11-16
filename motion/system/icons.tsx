// Line icons (Lucide) for motion templates. ICON_NAMES is the list offered in the Flowstate editor.
import React from 'react';
import * as L from 'lucide-react';

export const ICON_NAMES = ['Landmark', 'BookOpen', 'TrendingUp', 'TrendingDown', 'Coins', 'Banknote', 'PiggyBank', 'Wallet', 'Home', 'Wheat', 'Car', 'Fuel',
  'ShoppingCart', 'Scale', 'Ruler', 'Gauge', 'Factory', 'Building2', 'Briefcase', 'HandCoins', 'Lock', 'Clock', 'Flame', 'Zap'] as const;
export type IconName = string;
export const Icon: React.FC<{name: IconName; size?: number; color?: string; stroke?: number; style?: React.CSSProperties}> = ({name, size = 68, color = '#F0ECE2', stroke = 4, style}) => {
  const C = (L as unknown as Record<string, React.FC<any>>)[name] ?? (L as unknown as Record<string, React.FC<any>>).Circle;
  return <C size={size} color={color} strokeWidth={(stroke * 24) / size} style={style} />;
};
